with open('src/style.css', 'r', encoding='utf-8') as f:
    css = f.read()

# Add media query for responsive header modes
responsive_css = """
/* Responsive Compact Navigation to prevent overlapping on screens <= 1500px */
@media (max-width: 1500px) {
    .mode-tab {
        padding: 3.5px 7px !important;
        font-size: 10.5px !important;
        letter-spacing: -0.2px !important;
        border-radius: 10px !important;
    }
    .header-modes.center-modes {
        gap: 2.5px !important;
        padding: 2.5px 4px !important;
    }
    .town-pill-btn {
        padding: 3px 9px !important;
        font-size: 10.5px !important;
    }
    .btn-back-hero {
        padding: 5px 10px !important;
        font-size: 11px !important;
    }
}

@media (max-width: 1280px) {
    .mode-tab {
        padding: 3px 5.5px !important;
        font-size: 10px !important;
    }
    .header-modes.center-modes {
        gap: 2px !important;
    }
}
"""

if "Responsive Compact Navigation" not in css:
    css += responsive_css
    with open('src/style.css', 'w', encoding='utf-8') as f:
        f.write(css)
    print("Added responsive compact navigation styles!")
else:
    print("Already added!")
