with open('src/style.css', 'r', encoding='utf-8') as f:
    css = f.read()

# Replace .hero.hidden
old_hero_hidden = """.hero.hidden {
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
}"""

new_hero_hidden = """.hero.hidden {
  display: none !important;
  opacity: 0 !important;
  visibility: hidden !important;
  pointer-events: none !important;
}

.brand, .brand-mark, .brand-light, .brand-nav-link, .brand-mark-nav, .brand-nav-text {
  display: none !important;
  visibility: hidden !important;
  opacity: 0 !important;
  pointer-events: none !important;
}"""

if old_hero_hidden in css:
    css = css.replace(old_hero_hidden, new_hero_hidden)
    print("Replaced .hero.hidden successfully")
else:
    print("WARNING: old_hero_hidden not found exactly, trying regex or line replacement")
    import re
    css = re.sub(
        r'\.hero\.hidden\s*\{[^}]*\}',
        new_hero_hidden,
        css
    )
    print("Replaced via regex")

with open('src/style.css', 'w', encoding='utf-8') as f:
    f.write(css)

print("src/style.css updated!")
