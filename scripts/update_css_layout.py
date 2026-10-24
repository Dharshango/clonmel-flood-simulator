with open('src/style.css', 'r', encoding='utf-8') as f:
    css = f.read()

# 1. Update #top-nav.floating-header
old_nav_css = """#top-nav.floating-header {
    position: absolute;
    top: 16px;
    left: 20px;
    right: 20px;
    height: auto;
    padding: 0;
    background: transparent;
    border: none;
    backdrop-filter: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    z-index: 100;
    pointer-events: none; /* allows clicking 3D model through blank space */
}"""

new_nav_css = """#top-nav.floating-header {
    position: absolute;
    top: 12px;
    left: 16px;
    right: 16px;
    height: auto;
    padding: 0;
    background: transparent;
    border: none;
    backdrop-filter: none;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    z-index: 100;
    pointer-events: none; /* allows clicking 3D model through blank space */
}

.header-center-stack {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    flex: 1;
    min-width: 0;
    max-width: calc(100vw - 280px);
    pointer-events: none;
}"""

css = css.replace(old_nav_css, new_nav_css)

# 2. Update .header-modes.center-modes and .town-switcher-wrap
old_modes_css = """.header-modes.center-modes {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 5px;
    background: rgba(13, 19, 32, 0.82);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    padding: 4px 6px;
    border-radius: 20px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
    pointer-events: auto;
}"""

new_modes_css = """.header-modes.center-modes {
    position: relative;
    left: auto;
    top: auto;
    transform: none;
    display: flex;
    align-items: center;
    gap: 4px;
    background: rgba(13, 19, 32, 0.85);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    padding: 3px 6px;
    border-radius: 18px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.35);
    pointer-events: auto;
    max-width: 100%;
    overflow-x: auto;
    scrollbar-width: none;
}

.header-modes.center-modes::-webkit-scrollbar {
    display: none;
}"""

css = css.replace(old_modes_css, new_modes_css)

old_town_wrap = """.town-switcher-wrap {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    top: 46px;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: auto;
    z-index: 101;
}"""

new_town_wrap = """.town-switcher-wrap {
    position: relative;
    left: auto;
    top: auto;
    transform: none;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: auto;
    margin: 0;
    z-index: 101;
}"""

css = css.replace(old_town_wrap, new_town_wrap)

# 3. Update .clean-panel top offset so it doesn't collide with the header
css = css.replace("top: 70px;\n    bottom: 88px;", "top: 88px;\n    bottom: 88px;")
css = css.replace("top: 76px;\n    left: 50%;\n    transform: translateX(-50%);\n    z-index: 95;", "top: 96px;\n    left: 50%;\n    transform: translateX(-50%);\n    z-index: 95;")
css = css.replace("top: 72px;\n    left: 320px;", "top: 92px;\n    left: 320px;")

with open('src/style.css', 'w', encoding='utf-8') as f:
    f.write(css)

print("Updated style.css with non-overlapping header layout!")
