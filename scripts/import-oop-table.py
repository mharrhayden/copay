"""Import a tab-separated New/Continuing OOP pivot table without guessing weights."""
import argparse
import csv
import json
import re
from decimal import Decimal
from pathlib import Path

IDS = list('ABCDEFGHIJKLM') + list('OPQR')
RANGES = ['0', '0.01-5', '5.01-10', '10.01-15', '15.01-20', '20.01-25', '25.01-50', '50.01-100', '100.01-200', '200.01-300', '300.01-400', '400.01-500', '500.01-600', '600.01-800', '800.01-1000', '1000.01-1300', '1300+']
BY_RANGE = dict(zip(RANGES, IDS))

def cohort(label, product='product-x'):
    by_range = dict(zip(RANGES[:-2] + ['1000+'], IDS[:-1])) if product == 'product-y' else BY_RANGE
    match = re.fullmatch(r'[A-Z]+\.\s*(.+)', label.strip())
    if not match:
        raise ValueError(f'Invalid cohort label: {label!r}')
    interval = re.sub(r'[$,\s]', '', match[1]).replace('–', '-').replace('—', '-')
    if interval not in by_range:
        raise ValueError(f'Unknown OOP dollar range: {label!r}')
    return by_range[interval]

def read_table(path, product='product-x'):
    ids = IDS[:-1] if product == 'product-y' else IDS
    data = {}
    original = None
    rows = 0
    for number, row in enumerate(csv.reader(path.open(encoding='utf-8-sig'), delimiter='\t'), 1):
        if len(row) < 2 or not re.match(r'^[A-Z]+\.\s*\$', row[1].strip()):
            continue
        if len(row) < 14 or any(value.strip() for value in row[14:]):
            raise ValueError(f'Line {number}: expected exactly 12 fill columns')
        if row[0].strip():
            original = cohort(row[0], product)
        if original is None:
            raise ValueError(f'Line {number}: missing starting cohort')
        target = cohort(row[1], product)
        weights = []
        for cell in row[2:14]:
            if not cell.strip().endswith('%'):
                raise ValueError(f'Line {number}: expected a percentage')
            weight = Decimal(cell.strip().removesuffix('%')) * 100
            if not weight.is_finite() or weight != weight.to_integral_value() or not 0 <= weight <= 10000:
                raise ValueError(f'Line {number}: invalid percentage {cell!r}')
            weights.append(int(weight))
        if target in data.setdefault(original, {}):
            raise ValueError(f'Line {number}: duplicate {original}/{target}')
        data[original][target] = weights
        rows += 1
    if set(data) != set(ids):
        raise ValueError(f'Expected all {len(ids)} starting cohorts')
    totals = []
    for original in ids:
        destinations = data[original]
        if any(ids.index(target) > ids.index(original) for target in destinations):
            raise ValueError(f'{original}: destination exceeds starting OOP')
        for fill in range(12):
            total = sum(weights[fill] for weights in destinations.values())
            if abs(total - 10000) > 2:
                raise ValueError(f'{original}, fill {fill + 1}: source total {total / 100}%')
            totals.append(total)
        if destinations.get(original, [0])[0] != 10000 or any(weights[0] for target, weights in destinations.items() if target != original):
            raise ValueError(f'{original}: fill 1 must be fixed to the starting cohort')
        # A shared percentile must never produce an OOP increase. Compare exact
        # integer cumulative weights by cross multiplication, including rounding.
        for fill in range(1, 12):
            previous_total = sum(weights[fill - 1] for weights in destinations.values())
            current_total = sum(weights[fill] for weights in destinations.values())
            previous = current = 0
            for target in ids:
                previous += destinations.get(target, [0] * 12)[fill - 1]
                current += destinations.get(target, [0] * 12)[fill]
                if current * previous_total < previous * current_total:
                    raise ValueError(f'{original}, fill {fill + 1}: distribution would permit rising OOP')
    ordered = {original: {target: data[original][target] for target in ids if target in data[original]} for original in ids}
    return ordered, rows, min(totals), max(totals)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('--patient-type', choices=['new', 'continuing'], required=True)
    parser.add_argument('--product', choices=['product-x', 'product-y'], default='product-x')
    args = parser.parse_args()
    data, rows, minimum, maximum = read_table(args.source, args.product)
    root = Path(__file__).resolve().parent.parent
    name, export = ('subfill-data.js', 'subfillWeights') if args.patient_type == 'new' else ('continuing-subfill-data.js', 'continuingSubfillWeights')
    if args.product == 'product-y':
        name = 'product-y-' + name
        export = 'productYSubfillWeights' if args.patient_type == 'new' else 'productYContinuingSubfillWeights'
    text = '// Supplied ' + args.patient_type + ' patient OOP table; labels mapped by dollar range.\n// Integer weights are hundredths of a percent; rounded columns normalize during sampling.\n'
    text += f'export const {export} = ' + json.dumps(data, indent=2) + ';\n'
    text += f'for (const destinations of Object.values({export})) {{\n  for (const weights of Object.values(destinations)) Object.freeze(weights);\n  Object.freeze(destinations);\n}}\nObject.freeze({export});\n'
    (root / name).write_text(text)
    print(f'Imported {rows} rows across {len(data)} starting cohorts and 12 fills. Source totals: {minimum / 100:.2f}%–{maximum / 100:.2f}%. Wrote {name}.')
