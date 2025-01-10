# Load the .RData file
load("/home/ganesank/project/phytclust/Data/Villandre_2016/Villandre_data/pone.0148459.s003 (1).Rdata")

# List all objects in the environment
objects <- ls()
print(objects)

# Inspect each object
for (obj in objects) {
  print(paste("Object name:", obj))
  print(str(get(obj)))  # Print the structure of the object
}

# List all objects in the environment
object_names <- ls()

# Print each object name
for (obj_name in object_names) {
  print(obj_name)
}
# Print the structure of each object
str(data_all)
str(data_def3)
str(obj)
str(objects)
str(simulationResultsS1_BridgeWeight1)

# If it's a data frame or a similar tabular format, view the first few rows
if (is.data.frame(simulationResultsS1_BridgeWeight1) || is.list(simulationResultsS1_BridgeWeight1)) {
  head(simulationResultsS1_BridgeWeight1)
}

# Get a summary to understand distributions and presence of NA values
summary(simulationResultsS1_BridgeWeight1)
colnames(simulationResultsS1_BridgeWeight1)

# Access the specific lists within the object
list_8 <- simulationResultsS1_BridgeWeight1[[1]]
list_18 <- simulationResultsS1_BridgeWeight1[[18]]
list_9 <- simulationResultsS1_BridgeWeight1[[9]]
list_15 <- simulationResultsS1_BridgeWeight1[[15]]
list_20 <- simulationResultsS1_BridgeWeight1[[20]]
list_3 <- simulationResultsS1_BridgeWeight1[[3]]
list_52 <- simulationResultsS1_BridgeWeight1[[52]]

# Print the structure of each list to inspect them
str(list_8)
str(list_18)
str(list_9)
str(list_15)
str(list_20)
str(list_3)
str(list_52)
list_8$clusters
