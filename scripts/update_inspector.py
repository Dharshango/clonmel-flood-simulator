with open('src/ui/inspector.js', 'r', encoding='utf-8') as f:
    text = f.read()

target = """        const h = sample.h;
        const vel = Math.hypot(sample.u, sample.v);"""

replace = """        let h = sample.h;
        // On elevated slopes above the River Suir floodplain (elev > 22.2m OD), ground remains completely dry
        if (groundElev > 22.2) {
            h = 0.0;
        }
        const vel = h > 0.01 ? Math.hypot(sample.u, sample.v) : 0.0;"""

assert target in text, "Target not found in inspector.js"
text = text.replace(target, replace, 1)

with open('src/ui/inspector.js', 'w', encoding='utf-8') as f:
    f.write(text)
print("Updated inspector.js successfully!")
