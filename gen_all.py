import sys

#!/usr/bin/env python3
# Runner script to generate all compliance HTML files
import os
import importlib

# Add the script directory to path
base_dir = 'c:/Xamcode'
sys.path.insert(0, base_dir)

# Import all parts
import gen_part1
import gen_part3
import gen_part4

print('All compliance HTML files generated!')
