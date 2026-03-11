/**
 * Tree utilities: postorder, terminal count, ensure binary, branch lengths.
 * Mirrors phytclust validation and preparation.
 */

(function (global) {
  'use strict';

  function isTerminal(node) {
    return !node.clades || node.clades.length === 0;
  }

  /**
   * Collect all clades in postorder (children before parent).
   */
  function findCladesPostorder(root) {
    const out = [];
    function visit(node) {
      if (node.clades && node.clades.length) {
        node.clades.forEach(visit);
      }
      out.push(node);
    }
    visit(root);
    return out;
  }

  /**
   * Get list of terminal (leaf) nodes under this node.
   */
  function getTerminals(node) {
    if (isTerminal(node)) return [node];
    const list = [];
    if (node.clades) {
      node.clades.forEach(function (c) {
        getTerminals(c).forEach(function (t) {
          list.push(t);
        });
      });
    }
    return list;
  }

  /**
   * Ensure all non-root nodes have a numeric branch_length (default 1 if missing).
   */
  function ensureBranchLengths(root) {
    function visit(node, isRoot) {
      if (!isRoot && (node.branch_length == null || node.branch_length === 0)) {
        node.branch_length = 1;
      }
      if (node.clades) node.clades.forEach(function (c) { visit(c, false); });
    }
    visit(root, true);
  }

  /**
   * Resolve polytomies by inserting 0-length dummy nodes until binary.
   * Modifies tree in place.
   */
  function resolvePolytomies(root) {
    const queue = [root];
    while (queue.length) {
      const node = queue.shift();
      while (node.clades && node.clades.length > 2) {
        const left = node.clades.shift();
        const right = node.clades.shift();
        const dummy = {
          branch_length: 0,
          comment: 'DUMMY_NODE',
          clades: [left, right]
        };
        node.clades.push(dummy);
        queue.push(dummy);
      }
      if (node.clades) node.clades.forEach(function (c) { queue.push(c); });
    }
  }

  /**
   * Merge single-child chains (collapse and add branch lengths).
   */
  function mergeSingleChildClades(root) {
    const queue = [root];
    while (queue.length) {
      const node = queue.shift();
      while (node.clades && node.clades.length === 1) {
        const child = node.clades[0];
        node.name = child.name != null ? child.name : node.name;
        node.branch_length = (node.branch_length || 0) + (child.branch_length || 0);
        node.clades = child.clades || [];
      }
      if (node.clades) node.clades.forEach(function (c) { queue.push(c); });
    }
  }

  /**
   * Prepare tree for DP: ensure binary, branch lengths, then compute
   * postorder list, num_leaves_per_node, and optionally name_leaves_per_node.
   */
  function prepareTree(root, options) {
    options = options || {};
    mergeSingleChildClades(root);
    resolvePolytomies(root);
    const hasPositiveLength = [].some.call(
      findCladesPostorder(root),
      function (n) { return n !== root && (n.branch_length || 0) > 0; }
    );
    if (!hasPositiveLength) ensureBranchLengths(root);
    else {
      // ensure no undefined
      findCladesPostorder(root).forEach(function (n) {
        if (n !== root && n.branch_length == null) n.branch_length = 0;
      });
    }

    const postorderNodes = findCladesPostorder(root);
    const numLeavesPerNode = new Map();
    const nameLeavesPerNode = new Map();

    postorderNodes.forEach(function (node) {
      if (isTerminal(node)) {
        numLeavesPerNode.set(node, 1);
        nameLeavesPerNode.set(node, [node]);
      } else {
        const left = node.clades[0];
        const right = node.clades[1];
        numLeavesPerNode.set(
          node,
          (numLeavesPerNode.get(left) || 0) + (numLeavesPerNode.get(right) || 0)
        );
        nameLeavesPerNode.set(
          node,
          (nameLeavesPerNode.get(left) || []).concat(nameLeavesPerNode.get(right) || [])
        );
      }
    });

    const numTerminals = numLeavesPerNode.get(root) || 0;

    return {
      root: root,
      postorderNodes: postorderNodes,
      numLeavesPerNode: numLeavesPerNode,
      nameLeavesPerNode: nameLeavesPerNode,
      numTerminals: numTerminals
    };
  }

  global.TreeUtils = {
    isTerminal: isTerminal,
    findCladesPostorder: findCladesPostorder,
    getTerminals: getTerminals,
    ensureBranchLengths: ensureBranchLengths,
    resolvePolytomies: resolvePolytomies,
    mergeSingleChildClades: mergeSingleChildClades,
    prepareTree: prepareTree
  };
})(typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : this);
