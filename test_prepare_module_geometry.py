import importlib.util
import unittest
from pathlib import Path
spec = importlib.util.spec_from_file_location('prepare', Path(__file__).with_name('prepare_module_geometry.py'))
prepare = importlib.util.module_from_spec(spec)
spec.loader.exec_module(prepare)

class InstallationFlagsTest(unittest.TestCase):
    def test_flags_survive_yaml_lookup_conversion(self):
        location = {'layer': 3, 'signed_ladder': 1, 'z_side': 'z+', 'module_index': 1, 'installed': True, 'connected': False}
        lookup = {('0','0','0'): [{'module':'A', 'chip':0, 'efuse':'10'}, {'module':'A', 'chip':1, 'efuse':'11'}]}
        result = prepare.convert_geometry({'0/0/0':location}, lookup, 'fixture.yaml')
        self.assertIs(result['A']['installed'], True)
        self.assertIs(result['A']['connected'], False)
        self.assertEqual(result['A']['chips'], {0:'10',1:'11'})
    def test_legacy_flags_do_not_reject_an_installed_placement(self):
        lookup = {('0','0','0'): [{'module':'A', 'chip':0, 'efuse':'10'}, {'module':'A', 'chip':1, 'efuse':'11'}]}
        result = prepare.convert_geometry({'0/0/0':{'layer':3,'installed':'false'}}, lookup, 'fixture.yaml')
        self.assertIn('A', result)

if __name__ == '__main__': unittest.main()

class PortcardMappingTest(unittest.TestCase):
    def load(self, text):
        import tempfile
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'portcards.yaml'
            path.write_text(text)
            return prepare.load_portcards(path, {'M': {'subdetector': 'TBPX'}})
    def test_empty_inventory(self):
        self.assertEqual(self.load('{}'), {})
    def test_explicit_link(self):
        cards = self.load('PC: {slot: "TBPX:+z:right:W1:R1:C1", connections: [{module: M, lpgbt: 2}]}')
        self.assertEqual(cards['PC']['connections'][0]['lpgbt'], 2)
    def test_rejects_invalid_slots_and_banks(self):
        for text in [
            'PC: {slot: "TBPX:+z:right:W1:R2:C9", connections: [{module: M, lpgbt: 3}]}',
            'PC: {slot: "TBPX:-z:right:W1:R2:C9", connections: []}',
            'PC: {slot: "TBPX:+z:right:W1:R1:C1", connections: [{module: unknown, lpgbt: 0}]}',
        ]:
            with self.assertRaises(ValueError):
                self.load(text)
