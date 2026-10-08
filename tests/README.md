# Browser regression checks

From the repository root, with Python Playwright and Chromium installed:

```sh
python -m unittest discover -s tests -v
```

The suite starts and stops its own local HTTP server. It uses `/usr/bin/chromium`;
set `CHROMIUM_PATH` to use another installed Chromium executable.

Checks cover 1920×1080, 1024×768, 768×1024 and 1280×800 displays, 1–4 players,
both game modes, lowering controls and divider dragging, rotation after lowering,
old session callbacks, attack distribution and in-flight target protection,
multitouch, drag matching, sound settings, single-player speech and persistence.
Speech is intercepted to check invocation; actual speakers and Korean browser
voices must be checked on the target tablet or smart board.
Lowering/dragging checks cover the 66px/55px card steps, a 55px minimum on the
supported display sizes, restoration on raising, and attack-button contents
fitting inside the button. Fullscreen checks cover entry, button exit, external
exit and a rejected request, with labels following the actual browser state.
Voice checks also cover Korean-only selection, quality hints, delayed loading,
missing voices, preview and speed persistence, complete names during quick
matches, and quieter sounds during speech.

Every round now has six pairs (12 cards). Theme checks decode all five 16-icon
atlases, check picture/word mapping, match an entire round and verify that all
16 choices remain reachable. Attack controls occupy a separate footer.
