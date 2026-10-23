import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

m = re.search(r'<header class="topbar">.*?</header>', content, re.DOTALL)
if m:
    old_block = m.group(0)
    new_block = '''<header class="topbar">
                <div class="topbar-left"></div>
                <div class="topbar-right">
                    <a class="nav-link" href="#how-it-works" id="how-link">How it works <span aria-hidden="true">↗</span></a>
                </div>
            </header>'''
    content = content.replace(old_block, new_block)

content = content.replace('HOW HYDROVERSE WORKS', 'HOW THE SIMULATION WORKS')
content = content.replace('Hydroverse flood simulation', 'Clonmel flood simulation')
content = content.replace('Hydroverse Interactive Terrain', 'Interactive Terrain')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("index.html cleaned successfully")
