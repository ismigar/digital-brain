#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script de diagnóstico para verificar la extracción de tags desde Notion
"""
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from pipeline.notion_api import query_all_pages, get_page_properties, extract_tags
from config.app_config import load_params
from pprint import pprint

cfg = load_params()

# Obtener una nota de lectura
print("=== Obteniendo notas de lectura ===\n")
pages = query_all_pages(
    filter={"property": "Tipus de nota", "select": {"equals": "Nota de lectura"}}
)

if not pages:
    print("❌ No se encontraron notas de lectura")
    sys.exit(1)

print(f"✅ Encontradas {len(pages)} notas de lectura\n")

# Analizar la primera nota
page = pages[0]
print(f"=== Analizando nota: {page['id']} ===\n")

props = get_page_properties(page)
print("Propiedades disponibles:")
pprint(list(props.keys()))
print()

# Buscar la propiedad Tags
if "Tags" in props:
    print("=== Propiedad 'Tags' encontrada ===")
    tags_prop = props["Tags"]
    print(f"Tipo: {tags_prop.get('type')}")
    print(f"Contenido:")
    pprint(tags_prop)
    print()
    
    # Intentar extraer tags
    tag_aliases = cfg.notion.get("tags_property", "Tags")
    if isinstance(tag_aliases, str):
        tag_aliases = [tag_aliases]
    
    extracted_tags = extract_tags(props, tag_aliases)
    print(f"=== Tags extraídos ({len(extracted_tags)}) ===")
    pprint(extracted_tags)
else:
    print("❌ Propiedad 'Tags' NO encontrada")
    print("\nPropiedades de tipo multi_select disponibles:")
    for key, value in props.items():
        if isinstance(value, dict) and value.get("type") == "multi_select":
            print(f"  - {key}: {value.get('multi_select', [])}")
