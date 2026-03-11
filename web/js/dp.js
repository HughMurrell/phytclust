/**
 * Dynamic programming for monophyletic k-cluster partitioning.
 * Port of phytclust algo/dp.py: compute_dp_table and backtrack.
 */

(function (global) {
  'use strict';

  const INF = Number.POSITIVE_INFINITY;

  function effLength(node, opts) {
    const useSupport = opts && opts.use_branch_support;
    let base = node.branch_length != null ? node.branch_length : 0;
    if (!useSupport) return base;
    const raw = node.confidence != null ? node.confidence : 100;
    const minSupport = (opts && opts.min_support) || 0.05;
    const supportWeight = (opts && opts.support_weight) || 1;
    const p = Math.max(raw / 100, minSupport);
    return base + supportWeight * (-Math.log(p));
  }

  /**
   * Build DP tables with minimum cluster size constraint.
   * pc: { tree (root), postorderNodes, numLeavesPerNode, nodeToId, min_cluster_size?, max_k?, ... }
   * Fills: pc.dp_table, pc.backptr, pc.cluster_cost
   */
  function computeDpTable(pc) {
    const tree = pc.treeRoot || pc.tree;
    const nodes = pc.postorderNodes;
    const numLeavesPerNode = pc.numLeavesPerNode;
    const nodeToId = pc.nodeToId;
    const numTerminals = pc.numTerminals;
    const minClusterSize = pc.min_cluster_size != null ? pc.min_cluster_size : 1;
    const maxK = pc.max_k != null ? pc.max_k : numTerminals;
    const outlierThresh = pc.outlier_size_threshold;
    const outlierPenalty = pc.outlier_penalty || 0;
    const opts = { use_branch_support: pc.use_branch_support, min_support: pc.min_support, support_weight: pc.support_weight };

    const numNodes = nodes.length;
    const dpTable = new Array(numNodes);
    const backptr = new Array(numNodes);
    const clusterCost = new Map();

    const maxStatesGlobal = Math.min(maxK, numTerminals);
    if (maxStatesGlobal < 1) throw new Error('max_k (or num_terminals) must be >= 1');
    if (minClusterSize < 1) throw new Error('min_cluster_size must be >= 1');

    for (let ni = 0; ni < numNodes; ni++) {
      const node = nodes[ni];
      const nLeaves = numLeavesPerNode.get(node);
      const nStates = Math.min(nLeaves, maxStatesGlobal);

      const dpArray = new Array(nStates + 1);
      for (let i = 0; i <= nStates; i++) dpArray[i] = INF;
      const backptr0 = new Array(nStates + 1);
      const backptr1 = new Array(nStates + 1);
      for (let i = 0; i <= nStates; i++) { backptr0[i] = -1; backptr1[i] = -1; }

      if (TreeUtils.isTerminal(node)) {
        clusterCost.set(node, 0);
        if (nLeaves >= minClusterSize) dpArray[0] = 0;
        else dpArray[0] = INF;
        if (outlierThresh != null && outlierPenalty > 0 && nLeaves < outlierThresh && isFinite(dpArray[0])) {
          dpArray[0] += outlierPenalty;
        }
        dpTable[ni] = dpArray;
        backptr[ni] = [backptr0, backptr1];
        continue;
      }

      const left = node.clades[0];
      const right = node.clades[1];
      const leftId = nodeToId.get(left);
      const rightId = nodeToId.get(right);
      const leftDp = dpTable[leftId];
      const rightDp = dpTable[rightId];
      if (leftDp == null || rightDp == null) throw new Error('Child DP table missing');

      const nLeft = numLeavesPerNode.get(left);
      const nRight = numLeavesPerNode.get(right);
      const lenLeft = effLength(left, opts);
      const lenRight = effLength(right, opts);

      let costOneCluster = leftDp[0] + rightDp[0] + nLeft * lenLeft + nRight * lenRight;
      if (pc.use_branch_support) {
        const rawSupport = node.confidence != null ? node.confidence : 100;
        const minSupp = pc.min_support != null ? pc.min_support : 0.05;
        const support = Math.max(rawSupport / 100, minSupp);
        costOneCluster /= support;
      }
      clusterCost.set(node, costOneCluster);

      if (nLeaves >= minClusterSize) dpArray[0] = costOneCluster;
      else dpArray[0] = INF;
      if (outlierThresh != null && outlierPenalty > 0 && nLeaves < outlierThresh && isFinite(dpArray[0])) {
        dpArray[0] += outlierPenalty;
      }
      backptr0[0] = 0;
      backptr1[0] = 0;

      for (let k = 1; k <= nStates; k++) {
        const maxI = Math.min(k, leftDp.length - 1);
        const minI = Math.max(0, k - 1 - (rightDp.length - 1));
        if (minI > maxI) continue;

        let bestScore = INF;
        let bestI = minI;
        for (let i = minI; i <= maxI; i++) {
          const j = k - 1 - i;
          const score = leftDp[i] + rightDp[j];
          if (score < bestScore) {
            bestScore = score;
            bestI = i;
          }
        }
        dpArray[k] = bestScore;
        backptr0[k] = bestI;
        backptr1[k] = k - 1 - bestI;
      }

      dpTable[ni] = dpArray;
      backptr[ni] = [backptr0, backptr1];
    }

    pc.dp_table = dpTable;
    pc.backptr = backptr;
    pc.cluster_cost = clusterCost;
  }

  /**
   * Backtrack from root to get cluster assignment: Map<leafNode, clusterId (0..k-1)>.
   */
  function backtrack(pc, k) {
    if (k == null || k <= 0) throw new Error('k must be a positive integer');
    const root = pc.treeRoot || pc.tree;
    const rootId = pc.nodeToId.get(root);
    const rootDp = pc.dp_table[rootId];
    if (rootDp == null) throw new Error('DP table at root missing');

    const clusterIndex = k - 1;
    if (clusterIndex >= rootDp.length || !isFinite(rootDp[clusterIndex])) {
      throw new Error(
        'No feasible partition into ' + k + ' clusters with min_cluster_size=' + (pc.min_cluster_size || 1)
      );
    }

    const clusters = new Map();
    let currentClusterId = 0;
    const stack = [[rootId, clusterIndex]];
    const postorderNodes = pc.postorderNodes;
    const numLeavesPerNode = pc.numLeavesPerNode;
    const backptr = pc.backptr;

    while (stack.length) {
      const [nodeId, cIndex] = stack.pop();
      const node = postorderNodes[nodeId];

      if (cIndex === 0) {
        const leaves = TreeUtils.getTerminals(node);
        leaves.forEach(function (t) { clusters.set(t, currentClusterId); });
        currentClusterId++;
      } else {
        const leftK = backptr[nodeId][0][cIndex];
        const rightK = backptr[nodeId][1][cIndex];
        if (leftK < 0 || rightK < 0) throw new Error('Back-pointer missing');
        const left = node.clades[0];
        const right = node.clades[1];
        stack.push([pc.nodeToId.get(right), rightK]);
        stack.push([pc.nodeToId.get(left), leftK]);
      }
    }

    if (currentClusterId !== k) throw new Error('Number of clusters found: ' + currentClusterId + ', expected: ' + k);
    return clusters;
  }

  global.PhytClustDP = {
    computeDpTable: computeDpTable,
    backtrack: backtrack,
    effLength: effLength
  };
})(typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : this);
