
import os

OUT = 'c:/Xamcode'

def wf(name, content):
    with open(OUT + '/' + name, 'w', encoding='utf-8') as f:
        f.write(content)
    print('Created ' + name)

css_href = 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;display=swap'.replace('&', ';')

print('CSS href:', css_href)
print('Done')
