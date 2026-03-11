/**
 * PhytClust browser API: load Newick, prepare tree, run DP, get clusters.
 */

(function (global) {
  'use strict';

  function PhytClust(options) {
    options = options || {};
    this.tree = null;
    this.treeRoot = null;
    this.outgroup = options.outgroup || null;
    this.min_cluster_size = options.min_cluster_size != null ? options.min_cluster_size : 1;
    this.max_k_limit = options.max_k_limit != null ? options.max_k_limit : 0.9;
    this.max_k = options.max_k != null ? options.max_k : null;
    this.use_branch_support = options.use_branch_support || false;
    this.min_support = options.min_support != null ? options.min_support : 0.05;
    this.support_weight = options.support_weight != null ? options.support_weight : 1;
    this.outlier_size_threshold = options.outlier_size_threshold != null ? options.outlier_size_threshold : null;
    this.outlier_penalty = options.outlier_penalty != null ? options.outlier_penalty : 0;

    this.postorderNodes = null;
    this.nodeToId = null;
    this.numLeavesPerNode = null;
    this.nameLeavesPerNode = null;
    this.numTerminals = 0;
    this.dp_table = null;
    this.backptr = null;
    this._dpReady = false;
    this.clusters = {};
  }

  /**
   * Load tree from Newick string. Prepares tree and builds DP table.
   */
  PhytClust.prototype.loadNewick = function (newickStr) {
    const parsed = Newick.parse(newickStr);
    this.treeRoot = parsed.root;
    this.tree = { root: this.treeRoot };
    this._dpReady = false;
    this.numInternalNodes = TreeUtils.countInternalNodes(this.treeRoot);
    this.prepareTree();
    return this;
  };

  /**
   * Prepare tree: resolve polytomies, compute postorder and leaf counts.
   */
  PhytClust.prototype.prepareTree = function () {
    const prepped = TreeUtils.prepareTree(this.treeRoot, {});
    this.postorderNodes = prepped.postorderNodes;
    this.numLeavesPerNode = prepped.numLeavesPerNode;
    this.nameLeavesPerNode = prepped.nameLeavesPerNode;
    this.numTerminals = prepped.numTerminals;

    this.nodeToId = new Map();
    this.postorderNodes.forEach(function (node, i) {
      this.nodeToId.set(node, i);
    }, this);

    const limit = this.max_k != null ? this.max_k : Math.ceil(this.numTerminals * this.max_k_limit);
    this.max_k = Math.min(this.numTerminals, Math.max(2, limit));
    this._dpReady = false;
    return this;
  };

  /**
   * Ensure DP table is computed.
   */
  PhytClust.prototype._ensureDp = function () {
    if (this._dpReady) return;
    PhytClustDP.computeDpTable(this);
    this._dpReady = true;
  };

  /**
   * Get cluster assignment for exactly k clusters.
   * Returns Map<leafNode, clusterId> where clusterId in 0..k-1.
   */
  PhytClust.prototype.getClusters = function (k) {
    if (k == null || k < 1) throw new Error('k must be >= 1');
    if (k > this.numTerminals) throw new Error('k cannot exceed number of tips (' + this.numTerminals + ')');
    if (k > (this.max_k || 0)) {
      this.max_k = Math.min(this.numTerminals, k);
      this._dpReady = false;
    }
    this._ensureDp();
    if (this.clusters[k]) return this.clusters[k];
    const cmap = PhytClustDP.backtrack(this, k);
    this.clusters[k] = cmap;
    return cmap;
  };

  /**
   * Get the optimal DP cost (score) for exactly k clusters.
   * Returns a number, or null if not available.
   */
  PhytClust.prototype.getOptimalScore = function (k) {
    if (k == null || k < 1 || k > this.numTerminals) return null;
    this._ensureDp();
    const root = this.postorderNodes[this.postorderNodes.length - 1];
    const rootId = this.nodeToId.get(root);
    const row = this.dp_table[rootId];
    if (row == null) return null;
    const idx = k - 1;
    if (idx < 0 || idx >= row.length) return null;
    const val = row[idx];
    return typeof val === 'number' && isFinite(val) ? val : null;
  };

  /**
   * Get cluster assignment as object keyed by leaf name: { leafName: clusterId }.
   */
  PhytClust.prototype.getClustersByName = function (k) {
    const cmap = this.getClusters(k);
    const byName = {};
    cmap.forEach(function (clusterId, node) {
      const name = node.name != null ? node.name : String(node);
      byName[name] = clusterId;
    });
    return byName;
  };

  /**
   * Get list of leaf names in tree order (postorder of terminals).
   */
  PhytClust.prototype.getLeafNames = function () {
    const names = [];
    function visit(node) {
      if (TreeUtils.isTerminal(node)) {
        names.push(node.name != null ? node.name : '');
      } else if (node.clades) {
        node.clades.forEach(visit);
      }
    }
    visit(this.treeRoot);
    return names;
  };

  global.PhytClust = PhytClust;
})(typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : this);
