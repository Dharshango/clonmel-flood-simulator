import re

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

pattern = r'(<!-- Center Tabs: 7 Decision-Support Workspaces -->.*?)(<nav class="header-modes center-modes".*?</nav>\s*<div id="town-switcher-container" class="town-switcher-wrap"></div>)'
match = re.search(pattern, html, re.DOTALL)
if match:
    old_full = match.group(0)
    center_content = match.group(2)
    new_full = f'''<!-- Center Controls Stack: Workspaces Row + Town Switcher Row (Non-overlapping) -->
            <div class="header-center-stack">
                {center_content}
            </div>'''
    html = html.replace(old_full, new_full)
    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(html)
    print("Successfully wrapped in header-center-stack in index.html!")
else:
    print("Pattern not matched!")
