import json
import os
import tempfile
import unittest

import cv2
import numpy as np
import pandas as pd

from algo import all_hsv, entropy_region


class ProjectAnalysisPlanTest(unittest.TestCase):
    def test_each_image_uses_only_its_own_normalized_regions(self):
        with tempfile.TemporaryDirectory() as directory:
            images_dir = os.path.join(directory, 'images')
            os.makedirs(images_dir)
            cv2.imwrite(os.path.join(images_dir, 'a.png'), np.full((20, 40, 3), (0, 0, 255), np.uint8))
            cv2.imwrite(os.path.join(images_dir, 'b.png'), np.full((40, 20, 3), (0, 255, 0), np.uint8))
            plan = {
                'images': [
                    {
                        'fileName': 'a.png',
                        'regions': [{
                            'regionId': 'left',
                            'name': 'Left',
                            'polygon': [
                                {'x': 0, 'y': 0}, {'x': 0.5, 'y': 0},
                                {'x': 0.5, 'y': 1}, {'x': 0, 'y': 1},
                            ],
                        }],
                    },
                    {
                        'fileName': 'b.png',
                        'regions': [{
                            'regionId': 'top',
                            'name': 'Top',
                            'polygon': [
                                {'x': 0, 'y': 0}, {'x': 1, 'y': 0},
                                {'x': 1, 'y': 0.5}, {'x': 0, 'y': 0.5},
                            ],
                        }],
                    },
                ],
            }
            plan_path = os.path.join(directory, 'plan.json')
            output_path = os.path.join(directory, 'hsv.csv')
            with open(plan_path, 'w', encoding='utf-8') as file:
                json.dump(plan, file)

            all_hsv.process_images_HSV(plan_path, images_dir, output_path)
            output = pd.read_csv(output_path)

            self.assertEqual(set(output['image_name']), {'a.png', 'b.png'})
            self.assertEqual(
                set(zip(output['image_name'], output['region_id'])),
                {('a.png', 'left'), ('b.png', 'top')},
            )

    def test_entropy_accepts_arbitrary_project_region_id(self):
        with tempfile.TemporaryDirectory() as directory:
            input_path = os.path.join(directory, 'hsv.csv')
            output_path = os.path.join(directory, 'entropy.csv')
            pd.DataFrame([{
                'image_name': 'a.png',
                'region_id': 'user-region-any-id',
                'region_alias': 'Custom',
                'hsv_pixels': json.dumps([[0, 100, 200], [30, 110, 210], [60, 120, 220]]),
            }]).to_csv(input_path, index=False)

            result = entropy_region.process_entropy_csv(input_path, output_path)

            self.assertEqual(len(result), 1)
            self.assertEqual(result.iloc[0]['region_id'], 'user-region-any-id')


if __name__ == '__main__':
    unittest.main()
