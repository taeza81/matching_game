"""Run with: python -m unittest discover -s tests -v (Playwright + Chromium)."""
import functools
import http.server
import os
from pathlib import Path
import threading
import unittest
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

class GameRegression(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(QuietHandler, directory=str(ROOT)))
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.url = f'http://127.0.0.1:{cls.server.server_port}'
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium'), args=['--no-sandbox'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def setUp(self):
        self.context = self.browser.new_context(viewport={'width': 1920, 'height': 1080}, has_touch=True)
        self.context.add_init_script("""if (!localStorage.getItem('matching-game-preferences')) localStorage.setItem('matching-game-preferences', JSON.stringify({bgm:false,effects:false,voice:false,reducedMotion:true}));
            window.voiceList=[{name:'한국어 테스트 음성',lang:'ko-KR',voiceURI:'test-ko',default:false,localService:true}];
            speechSynthesis.getVoices=()=>window.voiceList;
            window.SpeechSynthesisUtterance=class {constructor(text){this.text=text;}};
            window.spoken=[]; window.utterances=[];
            window.speechSynthesis.speak=u=>{window.spoken.push(u.text);window.utterances.push(u);};""")
        self.page = self.context.new_page()
        self.page.set_default_timeout(6000)
        self.errors = []
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.page.goto(self.url)

    def tearDown(self):
        self.context.close()
        self.assertEqual(self.errors, [])

    def start(self, mode='coop', count=2):
        page = self.page
        if page.locator('#home-btn').is_visible():
            page.locator('#home-btn').tap()
        page.locator(f'button[data-mode="{mode}"]').tap()
        page.locator(f'button[data-count="{count}"]').tap()
        page.locator('#start-btn').tap()
        page.wait_for_function("document.querySelectorAll('.char-grid-item').length > 0")
        for number in range(1, count + 1):
            page.locator(f'#p{number}-interactive .char-grid-item').first.tap()
        page.locator('#global-start-btn').tap()
        page.wait_for_function("[...document.querySelectorAll('.game-card-grid')].every(g=>parseFloat(g.style.getPropertyValue('--card-size'))>0)")

    def match(self, player='p1'):
        item = self.page.locator(f'#{player}-interactive .card:not(.matched)').first.get_attribute('data-item')
        pair = self.page.locator(f'#{player}-interactive .card[data-item="{item}"]')
        pair.nth(0).tap()
        pair.nth(1).tap()

    def assert_boards(self):
        self.page.wait_for_timeout(70)
        problems = self.page.evaluate("""() => {
            const bad=[];
            const areas=[...document.querySelectorAll('.player-area')];
            if(areas.some(area=>Math.abs(area.getBoundingClientRect().top-areas[0].getBoundingClientRect().top)>1)) bad.push('players must stay in one row');
            for (const area of areas) {
                const a=area.getBoundingClientRect();
                if(a.x<0 || a.y<0 || a.right>innerWidth+1 || a.bottom>innerHeight+1) bad.push('area outside viewport');
                for (const c of area.querySelectorAll('.card')) {
                    const r=c.getBoundingClientRect(), z=area.querySelector('.interactive-zone').getBoundingClientRect();
                    if(r.width<43.9 || r.height<43.9) bad.push('small '+r.width+'x'+r.height);
                    const controls=area.querySelector('.player-controls');
                    if(controls && !controls.classList.contains('hidden') && r.bottom>controls.getBoundingClientRect().top+1) bad.push('card overlaps attack controls');
                    if(r.left<z.left-1 || r.right>z.right+1 || r.top<z.top-1 || r.bottom>z.bottom+1) bad.push('card outside '+area.id);
                }
            }
            return bad;
        }""")
        self.assertEqual(problems, [])
        self.assertEqual(self.page.locator('.card').count(),12 * self.page.locator('.player-area').count())

    def test_tablet_and_board_layouts_with_lowering(self):
        for size in [(1920,1080),(1024,768),(768,1024),(1280,800)]:
            self.page.set_viewport_size({'width':size[0], 'height':size[1]})
            for mode in ['coop','battle']:
                for count in range(1,5):
                    with self.subTest(size=size,mode=mode,count=count):
                        self.start(mode,count)
                        self.assert_boards()
                        for number in range(1,count+1):
                            self.page.locator(f'#p{number}-kid-btn').tap()
                        self.assert_boards()
                        for number in range(1,count+1):
                            handle=self.page.locator(f'#p{number}-divider .divider-handle').bounding_box()
                            x=handle['x']+handle['width']/2; y=handle['y']+handle['height']/2
                            self.page.mouse.move(x,y);self.page.mouse.down()
                            self.page.mouse.move(x,y+500,steps=4);self.page.mouse.up()
                        self.assert_boards()

    def test_rotation_after_lowering(self):
        self.page.set_viewport_size({'width':1024,'height':768})
        self.start('battle',4)
        for number in range(1,5): self.page.locator(f'#p{number}-kid-btn').tap()
        self.page.set_viewport_size({'width':768,'height':1024})
        self.assert_boards()
        self.page.set_viewport_size({'width':1280,'height':800})
        self.assert_boards()

    def test_old_callbacks_cannot_change_new_game(self):
        self.start('battle',2)
        self.page.evaluate('gameState.players.p1.attacksAvailable=1;updateHUD()')
        self.page.locator('#p1-attack-btn').tap()
        self.start('battle',2)
        self.page.wait_for_timeout(1100)
        self.assertEqual(self.page.evaluate('gameState.players.p2.hp'),100)
        self.start('coop',1)
        for _ in range(6): self.match()
        self.page.locator('#home-btn').tap()
        self.page.wait_for_timeout(900)
        self.assertEqual(self.page.locator('.card').count(),0)
        self.assertEqual(self.page.evaluate('sessionTasks.size'),0)
        self.assertEqual(self.page.locator('.game-effect').count(),0)
        self.start('coop',1)
        self.page.evaluate('preferences.voice=true')
        self.page.locator('#finish-btn').tap()
        self.page.locator('#home-btn').tap()
        self.page.wait_for_timeout(600)
        self.assertEqual(self.page.evaluate('window.spoken'),[])

    def test_sound_preferences_and_single_player_voice(self):
        self.start('coop',1)
        self.page.locator('#settings-btn').tap()
        self.page.locator('#setting-voice').check()
        self.page.locator('#setting-bgm').check()
        self.page.locator('#setting-effects').check()
        self.page.locator('#setting-motion').uncheck()
        self.page.locator('#setting-volume').evaluate("e=>{e.value='35';e.dispatchEvent(new Event('input',{bubbles:true}))}")
        self.assertEqual(self.page.evaluate('preferences.volume'),.35)
        self.page.locator('#settings-close-btn').tap()
        self.match()
        self.assertEqual(len(self.page.evaluate('window.spoken')),1)
        self.page.locator('#settings-btn').tap()
        self.page.locator('#quiet-mode-btn').tap()
        self.assertIsNone(self.page.evaluate('SoundEngine.bgmInterval'))
        self.assertEqual(self.page.evaluate('SoundEngine.tones.size'),0)
        self.assertEqual(self.page.evaluate('preferences'),{'bgm':False,'effects':False,'voice':False,'reducedMotion':True,'volume':.35,'voiceURI':'','voiceRate':.85})
        self.page.locator('#settings-close-btn').tap()
        self.start('coop',2)
        self.page.locator('#settings-btn').tap()
        self.assertTrue(self.page.locator('#setting-voice').is_disabled())
        self.page.locator('#settings-close-btn').tap()
        self.page.evaluate('window.spoken=[]; preferences.voice=true')
        self.match()
        self.page.locator('#finish-btn').tap()
        self.page.wait_for_timeout(600)
        self.assertEqual(self.page.evaluate('window.spoken'),[])
        self.page.reload()
        self.assertTrue(self.page.evaluate('preferences.reducedMotion'))
        self.assertFalse(self.page.evaluate('preferences.bgm'))
        self.assertEqual(self.page.evaluate('preferences.volume'),.35)

    def test_korean_voice_selection_preview_speed_and_persistence(self):
        self.start('coop',1)
        self.page.evaluate("""() => {
            preferences.voice=true;
            window.voiceList=[
                {name:'English default',lang:'en-US',voiceURI:'english',default:true},
                {name:'Microsoft Heami',lang:'ko-KR',voiceURI:'heami'},
                {name:'Google 한국의',lang:'ko_KR',voiceURI:'google-ko'},
                {name:'Microsoft SunHi Online (Natural)',lang:'ko-KR',voiceURI:'sunhi-natural'}
            ];
            speechSynthesis.dispatchEvent(new Event('voiceschanged'));
        }""")
        self.match()
        speech=self.page.evaluate("({voice:utterances.at(-1).voice.voiceURI,lang:utterances.at(-1).lang,rate:utterances.at(-1).rate,pitch:utterances.at(-1).pitch})")
        self.assertEqual(speech,{'voice':'sunhi-natural','lang':'ko-KR','rate':.85,'pitch':1})
        self.page.locator('#settings-btn').tap()
        self.assertEqual(self.page.locator('#setting-voice-select option').count(),4)
        self.assertIn('SunHi',self.page.locator('#voice-status').inner_text())
        self.page.locator('#setting-voice-select').select_option('google-ko')
        self.page.locator('#setting-voice-rate').evaluate("e=>{e.value='0.70';e.dispatchEvent(new Event('input',{bubbles:true}))}")
        self.page.locator('#voice-preview-btn').tap()
        self.assertEqual(self.page.evaluate('utterances.at(-1).voice.voiceURI'),'google-ko')
        self.assertEqual(self.page.evaluate('utterances.at(-1).rate'),.7)
        self.assertEqual(self.page.evaluate('spoken.at(-1)'),'연필. 풀. 자동차. 참 잘했어요!')
        self.page.reload()
        self.assertEqual(self.page.evaluate('preferences.voiceURI'),'google-ko')
        self.assertEqual(self.page.evaluate('preferences.voiceRate'),.7)
        self.start('coop',1)
        # A saved voice can be missing on a different tablet; fall back to Korean.
        self.match()
        self.assertEqual(self.page.evaluate('utterances.at(-1).voice.voiceURI'),'test-ko')
        self.start('coop',2)
        self.page.locator('#settings-btn').tap()
        self.assertTrue(self.page.locator('#setting-voice-select').is_disabled())
        self.assertTrue(self.page.locator('#setting-voice-rate').is_disabled())
        self.assertTrue(self.page.locator('#voice-preview-btn').is_disabled())

    def test_delayed_and_missing_korean_voices_and_home_cleanup(self):
        self.start('coop',1)
        self.page.evaluate("preferences.voice=true; window.voiceList=[]; VoiceEngine.speak('풀')")
        self.assertEqual(self.page.evaluate('spoken'),[])
        self.page.evaluate("""() => {
            window.voiceList=[{name:'Google 한국의',lang:'ko-KR',voiceURI:'google-ko'}];
            speechSynthesis.dispatchEvent(new Event('voiceschanged'));
        }""")
        self.assertEqual(self.page.evaluate('spoken'),['풀'])
        self.assertEqual(self.page.evaluate('utterances.at(-1).voice.voiceURI'),'google-ko')
        self.page.evaluate("window.voiceList=[]; VoiceEngine.speak('연필')")
        self.page.locator('#home-btn').tap()
        self.page.evaluate("window.voiceList=[{name:'Korean',lang:'ko-KR',voiceURI:'ko'}];speechSynthesis.dispatchEvent(new Event('voiceschanged'))")
        self.assertEqual(self.page.evaluate('spoken'),['풀'])
        self.assertEqual(self.page.evaluate('VoiceEngine.pending.length'),0)
        self.start('coop',1)
        self.page.evaluate("window.spoken=[];window.voiceList=[{name:'English',lang:'en-US',voiceURI:'en',default:true}];VoiceEngine.speak('자동차')")
        self.page.wait_for_timeout(2200)
        self.assertEqual(self.page.evaluate('spoken'),[])
        self.assertEqual(self.page.evaluate('VoiceEngine.pending.length'),0)
        self.assertIsNone(self.page.evaluate('VoiceEngine.waitTask'))
        self.page.locator('#settings-btn').tap()
        self.assertIn('한국어 음성을 사용할 수 없어요',self.page.locator('#voice-status').inner_text())
        self.assertTrue(self.page.locator('#voice-preview-btn').is_disabled())

    def test_background_and_effects_are_quieter_during_speech(self):
        self.start('coop',1)
        gains=self.page.evaluate("""() => {
            Object.assign(preferences,{voice:true,bgm:true,effects:true,volume:1});
            SoundEngine.init();
            const createGain=audioCtx.createGain.bind(audioCtx), values=[];
            audioCtx.createGain=()=>{
                const gain=createGain(), set=gain.gain.setValueAtTime.bind(gain.gain);
                gain.gain.setValueAtTime=(value,time)=>{values.push(value);return set(value,time);};
                return gain;
            };
            VoiceEngine.speak('연필');
            SoundEngine.playTone(400,'triangle',.1,'bgm');
            SoundEngine.playTone(500,'sine',.1,'effects');
            utterances.at(-1).onend();
            SoundEngine.playTone(400,'triangle',.1,'bgm');
            VoiceEngine.speak('풀');utterances.at(-1).onerror();
            return {values,remaining:VoiceEngine.utterances.size};
        }""")
        for value,expected in zip(gains['values'],[.015,.035,.1]): self.assertAlmostEqual(value,expected)
        self.assertEqual(len(gains['values']),3)
        self.assertEqual(gains['remaining'],0)

    def test_quick_matches_do_not_cut_off_korean_names(self):
        self.start('coop',1)
        self.page.evaluate("() => {preferences.voice=true;window.cancellations=0;speechSynthesis.cancel=()=>window.cancellations++;}")
        names=[]
        for _ in range(2):
            names.append(self.page.locator('.card:not(.matched)').first.get_attribute('data-label'))
            self.match()
        self.assertEqual(self.page.evaluate('spoken'),names)
        self.assertEqual(self.page.evaluate('window.cancellations'),0)
        self.page.locator('#home-btn').tap()
        self.assertGreater(self.page.evaluate('window.cancellations'),0)
        self.assertEqual(self.page.evaluate('VoiceEngine.utterances.size'),0)

    def test_attacks_are_balanced_and_no_simultaneous_target(self):
        self.start('battle',4)
        self.page.evaluate("Object.values(gameState.players).forEach(p=>p.attacksAvailable=20);updateHUD()")
        for _ in range(3):
            for number in range(1,5): self.page.evaluate(f"triggerAttack('p{number}')")
            incoming=self.page.evaluate('Object.values(gameState.players).map(p=>p.incomingAttacks)')
            self.assertTrue(all(value<=1 for value in incoming),incoming)
            self.page.wait_for_timeout(1100)
        hits=self.page.evaluate('Object.values(gameState.players).map(p=>p.attacksReceived)')
        self.assertLessEqual(max(hits)-min(hits),1)
        self.start('battle',2)
        self.page.evaluate('gameState.players.p1.attacksAvailable=2;updateHUD()')
        self.page.locator('#p1-attack-btn').tap()
        self.assertTrue(self.page.locator('#p1-attack-btn').is_disabled())
        self.page.evaluate("triggerAttack('p1')")
        self.assertEqual(self.page.evaluate('gameState.players.p1.attacksAvailable'),1)
        self.page.wait_for_timeout(1100)
        self.assertFalse(self.page.locator('#p1-attack-btn').is_disabled())

    def test_all_theme_assets_and_six_pairs(self):
        keys=self.page.evaluate('Object.keys(THEMES)')
        for index,key in enumerate(keys):
            with self.subTest(theme=key):
                self.page.locator('#home-btn').tap()
                self.page.locator('.theme-btn').nth(index).tap()
                self.start('coop',1)
                info=self.page.evaluate("""async () => {
                    const theme=THEMES[gameState.theme];
                    const image=new Image(); image.src=theme.image; await image.decode();
                    for(const override of Object.values(theme.overrides || {})) {const extra=new Image();extra.src=override.image;await extra.decode();}
                    const counts={};
                    for(const card of document.querySelectorAll('.card')) {
                        counts[card.dataset.item]=(counts[card.dataset.item]||0)+1;
                        if(card.dataset.label!==theme.words[card.dataset.item]) throw Error('Wrong word');
                        const source=theme.overrides?.[card.dataset.item] || theme;
                        const bounds=source.bounds || theme.sprites[card.dataset.item];
                        if(card.querySelector('.card-art image').getAttribute('href')!==source.image) throw Error('Wrong artwork');
                        if(card.querySelector('.card-art svg').getAttribute('viewBox')!==bounds.join(' ')) throw Error('Wrong bounds');
                        const clip=card.querySelector('clipPath rect');
                        if(!clip || ['x','y','width','height'].some((key,i)=>Number(clip.getAttribute(key))!==bounds[i])) throw Error('Missing clipping');
                    }
                    return {words:theme.words.length, cells:theme.columns*theme.rows,
                        image:[image.naturalWidth,image.naturalHeight],counts};
                }""")
                self.assertEqual(info['words'],16)
                self.assertEqual(info['cells'],16)
                self.assertEqual(info['image'][0],info['image'][1])
                self.assertEqual(len(info['counts']),6)
                self.assertTrue(all(count==2 for count in info['counts'].values()))
                for _ in range(6): self.match()
                self.assertEqual(self.page.evaluate('gameState.players.p1.stars'),6)
                self.page.wait_for_timeout(650)
                self.assertEqual(self.page.locator('.card:not(.matched)').count(),12)
                seen=self.page.evaluate("""() => {
                    const original=Math.random; let seed=1024; const seen=new Set();
                    try {
                        Math.random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
                        for(let round=0;round<32;round++) {
                            generateCards('p1');
                            document.querySelectorAll('.card').forEach(c=>seen.add(Number(c.dataset.item)));
                        }
                    } finally { Math.random=original; }
                    return [...seen].sort((a,b)=>a-b);
                }""")
                self.assertEqual(seen,list(range(16)))

    def test_praise_does_not_interrupt_the_last_name(self):
        self.start('coop',1)
        self.page.evaluate("""() => {
            preferences.voice=true; window.spoken=[]; window.cancellations=0;
            speechSynthesis.cancel=()=>window.cancellations++;
        }""")
        for _ in range(5): self.match()
        last_name=self.page.locator('.card:not(.matched)').first.get_attribute('data-label')
        self.match()
        cancellations=self.page.evaluate('window.cancellations')
        self.assertEqual(self.page.evaluate('window.spoken.at(-1)'),last_name)
        self.page.wait_for_timeout(900)
        self.assertEqual(self.page.evaluate('window.cancellations'),cancellations)
        self.assertEqual(self.page.evaluate('window.spoken.at(-2)'),last_name)
        self.assertIn(self.page.evaluate('window.spoken.at(-1)'),self.page.evaluate('VoiceEngine.praises'))
        self.page.locator('#home-btn').tap()
        self.assertGreater(self.page.evaluate('window.cancellations'),cancellations)

    def test_multitouch_and_drag_matching(self):
        self.start('coop',2)
        client=self.context.new_cdp_session(self.page)
        pairs=[]
        for player in ['p1','p2']:
            item=self.page.locator(f'#{player}-interactive .card').first.get_attribute('data-item')
            pairs.append(self.page.locator(f'#{player}-interactive .card[data-item="{item}"]'))
        def point(card, ident):
            b=card.bounding_box();return {'x':b['x']+b['width']/2,'y':b['y']+b['height']/2,'id':ident}
        first=[point(pairs[i].nth(0),i+1) for i in range(2)]
        client.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':first})
        client.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
        second=[point(pairs[i].nth(1),i+1) for i in range(2)]
        client.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':second})
        client.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
        self.assertEqual(self.page.evaluate('Object.values(gameState.players).map(p=>p.stars)'),[1,1])
        self.start('coop',1)
        item=self.page.locator('.card').first.get_attribute('data-item')
        pair=self.page.locator(f'.card[data-item="{item}"]')
        a=point(pair.nth(0),1);b=point(pair.nth(1),2)
        self.page.mouse.move(a['x'],a['y']);self.page.mouse.down()
        self.page.mouse.move(b['x'],b['y'],steps=8);self.page.mouse.up()
        self.assertEqual(self.page.locator('.card.matched').count(),2)

if __name__=='__main__': unittest.main()
