# SPDX-License-Identifier: 0BSD

from __future__ import annotations

import importlib
from pathlib import Path


def test_to_java_bytes_preserves_binary_payload_for_chaquopy(monkeypatch):
    android_python = (
        Path(__file__).resolve().parents[2]
        / "android"
        / "app"
        / "src"
        / "main"
        / "python"
    )
    monkeypatch.syspath_prepend(str(android_python))
    dispatcher = importlib.import_module("able.dispatcher")

    kiss_frame = bytes([0xC0, 0x08, 0x73, 0xC0])
    mutable_frame = bytearray(kiss_frame)

    assert dispatcher._to_java_bytes(kiss_frame) is kiss_frame
    assert dispatcher._to_java_bytes(mutable_frame) is mutable_frame
    assert dispatcher._to_java_bytes([1, 2, 3]) == [1, 2, 3]
