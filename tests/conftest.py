"""Pytest configuration for adaptive-lighting tests."""

import importlib
import sys
from pathlib import Path
from unittest.mock import patch

import pytest

# Make custom_components.adaptive_lighting importable as
# homeassistant.components.adaptive_lighting so tests can use either path.
_REPO_ROOT = Path(__file__).parent.parent
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

import custom_components.adaptive_lighting as _cc_al  # noqa: E402

import homeassistant.components as _hac  # noqa: E402

if not hasattr(_hac, "adaptive_lighting"):
    _hac.adaptive_lighting = _cc_al
    sys.modules["homeassistant.components.adaptive_lighting"] = _cc_al

    # Also register all already-imported sub-modules under the new namespace.
    _prefix_old = "custom_components.adaptive_lighting"
    _prefix_new = "homeassistant.components.adaptive_lighting"
    for _name, _mod in list(sys.modules.items()):
        if _name.startswith(_prefix_old):
            _new_name = _prefix_new + _name[len(_prefix_old) :]
            if _new_name not in sys.modules:
                sys.modules[_new_name] = _mod


@pytest.fixture(autouse=True)
def mock_template_deprecation_issue():
    """Mock the template deprecation issue creation.

    The template component's legacy platform syntax creates deprecation
    issues that require translations. Since adaptive-lighting tests use
    template lights as test fixtures (not testing the template integration
    itself), we mock the issue creation to avoid translation validation errors.
    """
    # Patch the create_legacy_template_issue function in the template helpers
    # to be a no-op when called for the deprecated_legacy_templates issue
    try:
        with patch(
            "homeassistant.components.template.helpers.create_legacy_template_issue",
        ):
            yield
    except (ImportError, ModuleNotFoundError, AttributeError):
        # Older HA versions don't have this function
        yield
