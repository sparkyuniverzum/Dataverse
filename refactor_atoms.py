import os
import re

directories_to_search = ["app", "tests", "scripts"]

replacements = {
    # Imports
    r"\bfrom app.models import (.*)\bAtom\b(.*)": r"from app.models import \1CivilizationRM\2",
    r"\bimport (.*)\bAtom\b(.*)": r"import \1CivilizationRM\2",
    # Class references
    r"\bAtom\b": "CivilizationRM",
    # Table references
    r'"atoms"': '"civilization_rm"',
    r"'atoms'": "'civilization_rm'",
    # Bond fields
    r"\bBond\.source_id\b": "Bond.source_civilization_id",
    r"\bBond\.target_id\b": "Bond.target_civilization_id",
    r"\b(?<!_)source_id\b": "source_civilization_id",
    r"\b(?<!_)target_id\b": "target_civilization_id",
}


def process_file(file_path):
    with open(file_path, encoding="utf-8") as f:
        content = f.read()

    new_content = content
    for old, new in replacements.items():
        if "source_id" in old or "target_id" in old:
            # jen jestli je to Python soubor a my vime ze to dava smysl,
            # ale aplikujeme to vsude, ptz source_id je pouzito u bond kontextu
            new_content = re.sub(old, new, new_content)
        else:
            new_content = re.sub(old, new, new_content)

    if new_content != content:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(new_content)
        print(f"Updated {file_path}")


for d in directories_to_search:
    for root, _, files in os.walk(d):
        for file in files:
            if file.endswith(".py"):
                process_file(os.path.join(root, file))
