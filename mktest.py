#!/usr/bin/env python3
"""
mktest.py
Creates random test data for ponder.

Data is in CSV format with the following columns:

  Name: a string
  Country: a string (country name)
  Visited: a comma-separated list of country names
  Restlessness: a random number between 0 and 100
  Mobility: a random number between 0 and 100, correlated with wanderlust
"""

import random
import csv

cons = "kwrtvmnpxyd"
vow = "aeiou"

def mkname():
  result = ''
  if random.random() > 0.5:
    result += random.choice(vow)
  for i in range(random.randint(1,3)):
    if random.random() > 0.1:
      result += random.choice(cons) + random.choice(vow)
    else:
      result += random.choice(vow)
  return result

COUNTRIES = [ mkname() for i in range(random.randint(8, 12)) ]

def mkrow():
  name = mkname()
  country = random.choice(COUNTRIES)
  visited = ','.join(
    set(
      random.choice(COUNTRIES)
        for i in range(random.randint(1, 6))
    )
  | set([country])
  )
  rl = 1 + random.random() * 99
  mb = 1 + random.random() * 99
  chances = 2
  while (
    (0.8 >= rl/mb or 1.2 <= rl/mb)
and random.random() > 0.5
and chances > 0
  ):
    chances -= 1
    if rl > mb:
      mb = 20 + random.random() * 80
    else:
      mb = 1 + random.random() * 79

  return name, country, visited, rl, mb

def mkdata():
  return [
    mkrow()
    for i in range(100)
  ]

if __name__ == "__main__":
  with open("data/demo.csv", 'w') as fout:
    writer = csv.writer(fout)
    writer.writerow(("Name", "Country", "Visited", "Restlessness", "Mobility"))
    for row in mkdata():
      writer.writerow(row)
