import os
import json
from typing import Any, Dict, Optional

BASE_DIR = os.path.dirname(__file__)
REGION_DIR = os.path.join(BASE_DIR, "data", "regions")
TASK_DIR = os.path.join(BASE_DIR, "data", "tasks")

os.makedirs(REGION_DIR, exist_ok=True)
os.makedirs(TASK_DIR, exist_ok=True)


def _path_for_region(image_id: str) -> str:
    return os.path.join(REGION_DIR, f"{image_id}.json")


def _path_for_task(task_id: str) -> str:
    return os.path.join(TASK_DIR, f"{task_id}.json")


def save_regions(image_id: str, regions: Any, metadata: Dict) -> None:
    payload = {"regions": regions, "metadata": metadata}
    with open(_path_for_region(image_id), "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)


def load_regions(image_id: str) -> Optional[Dict]:
    p = _path_for_region(image_id)
    if not os.path.exists(p):
        return None
    with open(p, "r", encoding="utf-8") as f:
        return json.load(f)


def save_task_status(task_id: str, status_payload: Dict) -> None:
    with open(_path_for_task(task_id), "w", encoding="utf-8") as f:
        json.dump(status_payload, f, ensure_ascii=False, indent=2)


def load_task_status(task_id: str) -> Optional[Dict]:
    p = _path_for_task(task_id)
    if not os.path.exists(p):
        return None
    with open(p, "r", encoding="utf-8") as f:
        return json.load(f)
