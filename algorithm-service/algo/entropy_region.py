import pandas as pd
import numpy as np
import json
from scipy.stats import entropy

# 示例标签集（根据需求更改）
region_id_list = [
  "01-00-00-00", "00-01-00-00", "00-02-00-00", "00-03-00-00", "00-04-00-00",
  "00-00-01-00", "00-00-01-01", "00-00-01-02", "00-00-02-00", "00-00-02-01",
  "00-00-02-02", "00-00-03-00", "00-00-04-00", "00-00-04-01", "00-00-04-02",
  "00-00-04-03", "00-00-04-04", "00-00-04-05", "00-00-04-06", "00-00-04-07",
  "00-00-04-08", "00-00-05-00", "00-00-05-01", "00-00-05-02", "00-00-06-00",
  "00-00-06-01", "00-00-06-02", "00-00-07-00", "00-00-08-00", "00-00-08-01",
  "00-00-08-02", "00-00-08-03", "00-00-08-04", "00-00-08-05", "00-00-08-06",
  "00-00-08-07", "00-00-08-08", "00-00-09-00", "00-00-09-01", "00-00-09-02",
  "00-00-10-00", "00-00-05-03", "00-00-05-04", "00-00-05-05", "00-00-05-06",
  "00-00-06-03", "00-00-06-04", "00-00-06-05", "00-00-06-06"
]


def extract_region_hsv(hsv_pixels, region_id, region_ids):
    if region_id in region_ids:
        return np.array(hsv_pixels)
    return None


def calculate_entropy_channels(hsv_array):
    if hsv_array is not None and len(hsv_array) > 0:
        h_values = hsv_array[:, 0]
        s_values = hsv_array[:, 1]
        v_values = hsv_array[:, 2]

        h_entropy = entropy(np.histogram(h_values, bins=36)[0])
        s_entropy = entropy(np.histogram(s_values, bins=10)[0])
        v_entropy = entropy(np.histogram(v_values, bins=10)[0])

        return h_entropy, s_entropy, v_entropy
    return None, None, None


def process_entropy_csv(input_csv, output_csv, chunk_size=50):
    aggregated_results = []

    for chunk in pd.read_csv(input_csv, chunksize=chunk_size):
        chunk['hsv_pixels'] = chunk['hsv_pixels'].apply(json.loads)

        for _, row in chunk.iterrows():
            hsv_pixels = row['hsv_pixels']
            region_id = row['region_id']

            hsv_data = extract_region_hsv(hsv_pixels, region_id, region_id_list)
            if hsv_data is not None:
                h_entropy, s_entropy, v_entropy = calculate_entropy_channels(hsv_data)
                if h_entropy is not None and s_entropy is not None and v_entropy is not None:
                    aggregated_results.append([
                        row['image_name'],
                        row['region_id'],
                        row['region_alias'],
                        h_entropy,
                        s_entropy,
                        v_entropy
                    ])

    aggregated_df = pd.DataFrame(
        aggregated_results,
        columns=['image_name', 'region_id', 'region_alias', 'H_entropy', 'S_entropy', 'V_entropy']
    )
    aggregated_df.to_csv(output_csv, index=False)
    return aggregated_df


if __name__ == '__main__':
    output_df = process_entropy_csv('lj2_all_hsv_results.csv', 'lj2_image_entropy_region_results.csv')
    print(output_df)
