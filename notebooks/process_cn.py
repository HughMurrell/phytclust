import os
import re
import subprocess
import glob
import csv
from timeit import default_timer as timer
from memory_profiler import memory_usage

# Paths
input_base_dir = "/home/ganesank/project/phytclust/runtime/100_nodes"
output_base_dir = "/home/ganesank/project/phytclust/runtime/PhyCLIP_high"
phyclip_script = "/home/ganesank/project/PhyCLIP/phyclip.py"
phyclip_dir = "/home/ganesank/project/PhyCLIP"
results_csv = "/home/ganesank/project/phytclust/runtime/PhyCLIP_high/phyclip_high_results.csv"

# Initialize results list
results = []


def process_newick_files():
    for dirpath, dirnames, filenames in os.walk(input_base_dir):
        for file in filenames:
            if file.endswith(".newick"):
                full_path = os.path.join(dirpath, file)
                with open(full_path, "r") as f:
                    content = f.read()

                # Remove internal node names (format might be: )name: changed to ):
                modified_content = re.sub(r"\)([^:]+):", r"):", content)

                # Prepare output path
                relative_path = os.path.relpath(dirpath, input_base_dir)
                output_dir = os.path.join(output_base_dir, relative_path)
                if not os.path.exists(output_dir):
                    os.makedirs(output_dir)

                output_file_path = os.path.join(output_dir, file)
                with open(output_file_path, "w") as f:
                    f.write(modified_content)
                print("Processed and saved: {}".format(output_file_path))


def create_input_file(tree_file, subdir):
    """Create an input.txt in the subdir with tree path and parameters."""
    input_text = "{}\n2, 0.1-0.36(0.05), 4-5(1)\n".format(tree_file)
    input_path = os.path.join(subdir, "input.txt")
    with open(input_path, "w") as f:
        f.write(input_text)
    return input_path


def cleanup_files(directory):
    """Remove specific files from the directory before running the analysis."""
    # Delete summary-stats_input.txt if it exists
    summary_stats_path = os.path.join(directory, "summary-stats_input.txt")
    if os.path.exists(summary_stats_path):
        os.remove(summary_stats_path)
        print("Removed existing summary stats file: {}".format(summary_stats_path))

    # Delete any supertree_*_treeinfo.npz files
    for npz_file in glob.glob(os.path.join(directory, "supertree_*_treeinfo.npz")):
        os.remove(npz_file)
        print("Removed tree info file: {}".format(npz_file))


def run_phyclip(input_file, output_dir):
    """Run phyclip.py with the given input file and save output to output.txt."""
    os.chdir(output_dir)  # Change working directory to where input.txt is saved
    output_path = os.path.join(output_dir, "output.txt")
    command = "phyclip.py --input_file {} --pdf_tree --optimise intermediate".format(
        input_file
    )
    print("Running command: {}".format(command))

    # Measure runtime and memory usage of the command
    start_time = timer()
    mem_usage, result = memory_usage(
        (
            subprocess.call,
            (command,),
            {"shell": True},
        ),
        retval=True,
    )
    end_time = timer()
    runtime = end_time - start_time
    peak_memory = max(mem_usage)

    # Extract file size and number from the input file name
    file_name = os.path.basename(input_file)
    size, num = map(int, re.findall(r"\d+", file_name))

    # Append results
    results.append(
        {
            "file": file_name,
            "size": size,
            "num": num,
            "runtime": runtime,
            "peak_memory": peak_memory,
        }
    )

    with open(output_path, "w") as f:
        f.write(
            "Runtime: {:.2f} seconds\nPeak memory: {:.2f} MiB\n".format(
                runtime, peak_memory
            )
        )
    print("Output saved to: {}".format(output_path))


def save_results_to_csv():
    """Save the results to a CSV file."""
    with open(results_csv, mode="w", newline="") as file:
        writer = csv.DictWriter(
            file, fieldnames=["file", "size", "num", "runtime", "peak_memory"]
        )
        writer.writeheader()
        for result in results:
            writer.writerow(result)


def process_trees():
    # Walk through the base directory and process .newick files in iteration_* subdirectories
    for dirpath, dirnames, filenames in os.walk(input_base_dir):
        for filename in sorted(filenames):
            if filename.endswith(".newick"):
                tree_file_path = os.path.join(dirpath, filename)
                subdir = os.path.join(
                    dirpath, filename.replace(".newick", "_subfolder")
                )

                if not os.path.exists(subdir):
                    os.makedirs(subdir)

                # Cleanup before processing
                cleanup_files(subdir)

                input_file = create_input_file(tree_file_path, subdir)
                run_phyclip(input_file, subdir)
                print("Processed tree and PhyCLIP output saved in: {}".format(subdir))


if __name__ == "__main__":
    process_newick_files()
    process_trees()
    save_results_to_csv()
    print("Results saved to CSV:", results_csv)
# import pandas as pd
# import glob
# import os
# import logging

# # Set up logging
# logging.basicConfig(
#     level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
# )


# def sort_and_group_tsv(input_file, output_file):
#     try:
#         logging.info(f"Processing file: {input_file}")

#         # Read the entire file into a DataFrame
#         df = pd.read_csv(input_file, sep="\t")

#         # Convert chromosome column to integers for sorting
#         df["chr"] = df["chr"].str.replace("chr", "").replace({"X": 23}).astype(int)

#         # Sort by sample_id, chr, and start
#         df = df.sort_values(by=["sample_id", "chr", "start"])

#         # Initialize a list to store the merged segments
#         merged_segments = []

#         # Iterate through the sorted DataFrame and merge segments
#         current_segment = None
#         for _, row in df.iterrows():
#             if current_segment is None:
#                 current_segment = row
#             else:
#                 if (
#                     current_segment["sample_id"] == row["sample_id"]
#                     and current_segment["chr"] == row["chr"]
#                     and current_segment["cn_a"] == row["cn_a"]
#                     and current_segment["cn_b"] == row["cn_b"]
#                 ):
#                     # Merge segments
#                     current_segment["start"] = min(
#                         current_segment["start"], row["start"]
#                     )
#                     current_segment["end"] = max(current_segment["end"], row["end"])
#                 else:
#                     # Append the current segment to the list and start a new segment
#                     merged_segments.append(current_segment)
#                     current_segment = row

#         # Append the last segment
#         if current_segment is not None:
#             merged_segments.append(current_segment)

#         # Convert the merged segments to a DataFrame
#         final_df = pd.DataFrame(merged_segments)

#         # Convert chromosome column back to 'X' where applicable
#         final_df["chr"] = final_df["chr"].replace({23: "X"}).astype(str)
#         final_df["chr"] = "chr" + final_df["chr"]

#         # Save the final grouped DataFrame to a new TSV file
#         final_df.to_csv(output_file, sep="\t", index=False)
#         logging.info(f"Finished processing file: {output_file}")
#     except Exception as e:
#         logging.error(f"Error processing file {input_file}: {e}")


# # Directory containing the TSV files
# input_dir = "/home/ganesank/project/phytclust/Data/Roland_2015/processed_chunks/raw"
# output_dir = (
#     "/home/ganesank/project/phytclust/Data/Roland_2015/processed_chunks/grouped"
# )

# # Ensure the output directory exists
# os.makedirs(output_dir, exist_ok=True)

# # Find all _sorted.tsv files in the input directory
# input_files = glob.glob(os.path.join(input_dir, "*04_sorted.tsv"))

# # Process each file
# for input_file in input_files:
#     # Generate the output file name
#     file_name = os.path.basename(input_file)
#     output_file = os.path.join(
#         output_dir, file_name.replace("_sorted.tsv", "_sorted_grouped.tsv")
#     )

#     # Check if the output file already exists
#     if os.path.exists(output_file):
#         logging.info(f"Skipping already processed file: {output_file}")
#         continue

#     # Sort and group the TSV file
#     sort_and_group_tsv(input_file, output_file)

# logging.info("Processing completed.")
# import pandas as pd
# import glob
# import os
# import logging

# # Set up logging
# logging.basicConfig(
#     level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
# )


# def sort_and_group_tsv(input_file, output_file, chunk_size=1000):
#     try:
#         logging.info(f"Processing file: {input_file}")

#         chunk_list = []
#         for chunk in pd.read_csv(input_file, sep="\t", chunksize=chunk_size):
#             # Convert chromosome column to integers for sorting
#             chunk["chr"] = (
#                 chunk["chr"].str.replace("chr", "").replace({"X": 23}).astype(int)
#             )
#             chunk_list.append(chunk)

#         # Concatenate all chunks into a single DataFrame
#         df = pd.concat(chunk_list)

#         # Sort by sample_id, chr, and start
#         df = df.sort_values(by=["sample_id", "chr", "start"])

#         # Convert chromosome column back to 'X' where applicable
#         df["chr"] = df["chr"].replace({23: "X"}).astype(str)
#         df["chr"] = "chr" + df["chr"]

#         # Group by the required columns and calculate the smallest start and largest end
#         grouped_df = df.groupby(
#             ["sample_id", "chr", "cn_a", "cn_b"], as_index=False
#         ).agg(start=("start", "min"), end=("end", "max"))

#         # Save the grouped DataFrame to a new TSV file
#         grouped_df.to_csv(output_file, sep="\t", index=False)
#         logging.info(f"Finished processing file: {output_file}")
#     except Exception as e:
#         logging.error(f"Error processing file {input_file}: {e}")


# # Directory containing the TSV files
# input_dir = "/home/ganesank/project/phytclust/Data/Roland_2015/processed_chunks"
# output_dir = (
#     "/home/ganesank/project/phytclust/Data/Roland_2015/processed_chunks/grouped"
# )

# # Ensure the output directory exists
# os.makedirs(output_dir, exist_ok=True)

# # Find all _sorted.tsv files in the input directory
# input_files = glob.glob(os.path.join(input_dir, "*4_sorted.tsv"))

# # Process each file
# for input_file in input_files:
#     # Generate the output file name
#     file_name = os.path.basename(input_file)
#     output_file = os.path.join(
#         output_dir, file_name.replace("_sorted.tsv", "_sorted_grouped.tsv")
#     )

#     # Check if the output file already exists
#     if os.path.exists(output_file):
#         logging.info(f"Skipping already processed file: {output_file}")
#         continue

#     # Sort and group the TSV file
#     sort_and_group_tsv(input_file, output_file)

# logging.info("Processing completed.")

# import pandas as pd
# import glob
# import os
# import logging

# # Set up logging
# logging.basicConfig(
#     level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
# )


# def sort_and_group_tsv(input_file, output_file):
#     try:
#         logging.info(f"Processing file: {input_file}")
#         # Load the data
#         df = pd.read_csv(input_file, sep="\t")

#         # Convert chromosome column to integers for sorting
#         df["chr"] = df["chr"].str.replace("chr", "").replace({"X": 23}).astype(int)

#         # Sort by sample_id, chr, and start
#         df = df.sort_values(by=["sample_id", "chr", "start"])

#         # Convert chromosome column back to 'X' where applicable
#         df["chr"] = df["chr"].replace({23: "X"}).astype(str)
#         df["chr"] = "chr" + df["chr"]

#         # Save the sorted DataFrame to a new TSV file
#         df.to_csv(output_file, sep="\t", index=False)
#         logging.info(f"Finished processing file: {output_file}")
#     except Exception as e:
#         logging.error(f"Error processing file {input_file}: {e}")


# # Directory containing the TSV files
# input_dir = "/home/ganesank/project/phytclust/Data/Roland_2015/processed_chunks"
# output_dir = (
#     "/home/ganesank/project/phytclust/Data/Roland_2015/processed_chunks/grouped"
# )

# # Ensure the output directory exists
# os.makedirs(output_dir, exist_ok=True)

# # Find all _sorted.tsv files in the input directory
# input_files = glob.glob(os.path.join(input_dir, "*_sorted.tsv"))

# # Process each file
# for input_file in input_files:
#     # Generate the output file name
#     file_name = os.path.basename(input_file)
#     output_file = os.path.join(
#         output_dir, file_name.replace("_sorted.tsv", "_sorted_grouped.tsv")
#     )

#     # Check if the output file already exists
#     if os.path.exists(output_file):
#         logging.info(f"Skipping already processed file: {output_file}")
#         continue

#     # Sort and group the TSV file
#     sort_and_group_tsv(input_file, output_file)

# logging.info("Processing completed.")
