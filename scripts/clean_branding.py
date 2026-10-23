import re

with open('index.html', 'r', encoding='utf-8') as f:
    c = f.read()

# 1. Title and favicon
c = c.replace('<title>Hydroverse — See the flood before it flows</title>', '<title>Clonmel Flood Simulation & Intelligence Platform</title>')
c = re.sub(r'<link rel="icon"[^>]*>', '<link rel="icon" href="data:;base64,iVBORw0KGgo=">', c)
c = re.sub(r'<link rel="alternate icon"[^>]*>', '', c)
c = re.sub(r'<link rel="apple-touch-icon"[^>]*>', '', c)

# 2. Remove brand-nav-home in top-nav
c = re.sub(r'\s*<div class="brand-nav-link" id="brand-nav-home"[\s\S]*?</div>', '', c)

with open('index.html', 'w', encoding='utf-8', newline='\r\n') as f:
    f.write(c)

print('Cleaned branding from index.html')
