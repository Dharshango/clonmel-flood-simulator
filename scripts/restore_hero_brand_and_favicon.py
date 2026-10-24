import re

path = 'c:/Users/dhars/OneDrive/Desktop/Projects/clonmel-flood-simulator/index.html'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Favicon links
old_fav = '<link rel="icon" href="data:;base64,iVBORw0KGgo=">'
new_fav = '''<link rel="icon" type="image/svg+xml" href="/brand-mark.svg">
    <link rel="alternate icon" href="/favicon.svg">
    <link rel="apple-touch-icon" href="/brand-mark.svg">'''

if old_fav in content:
    content = content.replace(old_fav, new_fav)
    print('Updated favicon in index.html')
else:
    print('Favicon target not found')

# 2. Hero topbar brand logo
old_brand = '<div class="topbar-left"></div>'
new_brand = '''<a class="brand" href="#home" aria-label="Hydroverse home">
                    <svg class="brand-mark" viewBox="0 0 40 40" fill="none" aria-hidden="true">
                        <path d="M20 4.8C20 4.8 8.5 17.2 8.5 24.5a11.5 11.5 0 0 0 23 0C31.5 17.2 20 4.8 20 4.8Z" stroke="currentColor" stroke-width="1.5" />
                        <path d="M13.3 25.7c2.6 2.2 5.4 3.3 8.1 3.1 2-.2 3.8-.9 5.4-2.2M15.8 19.8c1.4.7 2.8 1 4.3 1 1.5-.1 3-.5 4.4-1.3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
                    </svg>
                    <span>hydro<span class="brand-light">verse</span></span>
                </a>'''

if old_brand in content:
    content = content.replace(old_brand, new_brand)
    print('Updated brand in index.html')
else:
    print('Brand target not found')

# 3. Eyebrow in dialog
content = content.replace('HOW THE SIMULATION WORKS', 'HOW HYDROVERSE WORKS')
content = content.replace('aria-label="Clonmel flood simulation"', 'aria-label="Hydroverse flood simulation"')

with open(path, 'w', encoding='utf-8', newline='') as f:
    f.write(content)

print('Finished index.html update')
