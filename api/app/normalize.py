"""1:1 port of web/src/normalizeState.ts, operating on a raw dict before
Pydantic validation. Needed so the import endpoint can accept the same
older/legacy-format project files the frontend's local-mode import already
handles (missing fields filled with defaults, the deprecated single-nail
box-relative-percentage format migrated to the current cm-offset array) —
without this, an old export would just fail Pydantic validation instead of
being migrated. Keep in sync with normalizeState.ts if that ever changes.
"""


def normalize_state(parsed: dict) -> dict:
    if not isinstance(parsed, dict) or not parsed.get("wall") or not isinstance(parsed.get("images"), list):
        raise ValueError("Not a wall-projector project file")

    if not parsed.get("ruler"):
        parsed["ruler"] = {"length": 100, "visible": True, "color": "#ffcc00"}
    if not parsed["ruler"].get("color"):
        parsed["ruler"]["color"] = "#ffcc00"

    if not parsed.get("background"):
        parsed["background"] = {"enabled": False, "color": "#2a2a2a", "projectToo": False}
    if parsed["background"].get("projectToo") is None:
        parsed["background"]["projectToo"] = False

    if not parsed.get("defaults"):
        parsed["defaults"] = {"imageWidth": 30, "frameEnabled": False, "frameColor": "black", "frameWidth": 3}

    if not parsed.get("grid"):
        parsed["grid"] = {"enabled": False, "size": 20, "projectToo": False}
    if parsed["grid"].get("projectToo") is None:
        parsed["grid"]["projectToo"] = False

    if not parsed.get("nail"):
        parsed["nail"] = {"enabled": False, "color": "#ff3b3b", "size": 10}

    if not parsed.get("keystone"):
        parsed["keystone"] = {"enabled": False, "vertical": 0, "horizontal": 0}

    wall = parsed["wall"]
    for im in parsed["images"]:
        if not im.get("frame"):
            im["frame"] = {"enabled": False, "color": "black", "width": 3}
        if not isinstance(im.get("nails"), list):
            w_real = (im["wPct"] / 100) * wall["width"]
            h_real = (im["hPct"] / 100) * wall["height"]
            if im.get("nailXPct") is not None and im.get("nailYPct") is not None:
                # migrate from the old single-nail, box-relative-percentage format
                im["nails"] = [{"xCm": (im["nailXPct"] / 100) * w_real, "yCm": (im["nailYPct"] / 100) * h_real}]
            else:
                im["nails"] = [{"xCm": w_real / 2, "yCm": h_real / 2}]
        im.pop("nailXPct", None)
        im.pop("nailYPct", None)
        if im.get("aspectLocked") is None:
            im["aspectLocked"] = True
        if im.get("crop") is None:
            im["crop"] = False
        if im.get("snapToGrid") is None:
            im["snapToGrid"] = False

    return parsed
