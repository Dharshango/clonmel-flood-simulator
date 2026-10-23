with open('src/main.js', 'r', encoding='utf-8') as f:
    code = f.read()

old_block = """    const launchSimulation = () => {

        if (heroSection) heroSection.classList.add('hidden');

    };"""

new_block = """    const launchSimulation = () => {
        if (heroSection) {
            heroSection.classList.add('hidden');
            heroSection.style.display = 'none';
        }
    };"""

if old_block in code:
    code = code.replace(old_block, new_block)
    print("Replaced launchSimulation successfully")
else:
    print("WARNING: old_block not found exactly, using regex")
    import re
    code = re.sub(
        r'const launchSimulation = \(\) => \{\s*if \(heroSection\) heroSection\.classList\.add\(\'hidden\'\);\s*\};',
        new_block,
        code
    )

old_back = """    if (btnBackHero && heroSection) {

        btnBackHero.addEventListener('click', () => {

            heroSection.classList.remove('hidden');

        });

    }"""

new_back = """    if (btnBackHero && heroSection) {
        btnBackHero.addEventListener('click', () => {
            heroSection.style.display = '';
            heroSection.classList.remove('hidden');
        });
    }"""

if old_back in code:
    code = code.replace(old_back, new_back)
    print("Replaced btnBackHero successfully")
else:
    print("WARNING: old_back not found exactly, using regex")
    import re
    code = re.sub(
        r'if \(btnBackHero && heroSection\) \{\s*btnBackHero\.addEventListener\(\'click\', \(\) => \{\s*heroSection\.classList\.remove\(\'hidden\'\);\s*\}\);\s*\}',
        new_back,
        code
    )

with open('src/main.js', 'w', encoding='utf-8') as f:
    f.write(code)

print("src/main.js updated!")
