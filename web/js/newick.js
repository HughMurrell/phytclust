/**
 * Newick format parser for phylogenetic trees.
 * Produces a rooted tree with nodes: { name, branch_length, confidence?, clades }
 * - clades: array of 0 (leaf) or 2 (internal) child nodes.
 */

(function (global) {
  'use strict';

  function parseNumber(s) {
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }

  /** Parse optional :length[support] from start of str. Returns { branch_length, confidence, rest }. */
  function parseLengthAndSupport(str) {
    let idx = 0;
    while (idx < str.length && /[\s\n\r]/.test(str[idx])) idx++;
    let branch_length = 0;
    let confidence = null;
    if (str[idx] === ':') {
      idx++;
      while (idx < str.length && /[\s\n\r]/.test(str[idx])) idx++;
      const numStart = idx;
      while (idx < str.length && /[0-9.Ee\-+]/.test(str[idx])) idx++;
      branch_length = parseNumber(str.slice(numStart, idx));
      while (idx < str.length && /[\s\n\r]/.test(str[idx])) idx++;
      if (str[idx] === '[') {
        idx++;
        const suppStart = idx;
        while (idx < str.length && str[idx] !== ']') idx++;
        confidence = parseNumber(str.slice(suppStart, idx));
        if (str[idx] === ']') idx++;
      }
    }
    return { branch_length, confidence, rest: str.slice(idx) };
  }

  /**
   * Parse a single token from Newick string. Returns { token, rest }.
   * Tokens: '(', ')', ',', ';', or a quoted/label segment.
   */
  function nextToken(str) {
    let i = 0;
    while (i < str.length && /[\s\n\r]/.test(str[i])) i++;
    if (i >= str.length) return { token: null, rest: '' };
    const start = i;
    const c = str[i];
    if (c === '(' || c === ')' || c === ',' || c === ';') {
      return { token: c, rest: str.slice(i + 1) };
    }
    if (c === "'") {
      i++;
      let label = '';
      while (i < str.length && str[i] !== "'") {
        if (str[i] === '\\') i++;
        label += str[i++];
      }
      if (i < str.length) i++;
      return { token: label, rest: str.slice(i) };
    }
    // unquoted label or number: [^();,\s\[\]:]+
    while (i < str.length && /[^();,\s\[\]:]/.test(str[i])) i++;
    let segment = str.slice(start, i);
    while (i < str.length && /[\s\n\r]/.test(str[i])) i++;
    if (i < str.length && str[i] === ':') {
      i++;
      while (i < str.length && /[\s\n\r]/.test(str[i])) i++;
      let numStart = i;
      while (i < str.length && /[0-9.Ee\-+]/.test(str[i])) i++;
      const lenStr = str.slice(numStart, i);
      const branchLength = parseNumber(lenStr);
      while (i < str.length && /[\s\n\r]/.test(str[i])) i++;
      let confidence = null;
      if (str[i] === '[') {
        i++;
        let suppStart = i;
        while (i < str.length && str[i] !== ']') i++;
        confidence = parseNumber(str.slice(suppStart, i));
        if (i < str.length) i++;
      }
      return {
        token: { label: segment || null, branch_length: branchLength, confidence },
        rest: str.slice(i)
      };
    }
    return { token: segment || null, rest: str.slice(i) };
  }

  /**
   * Parse subtree: ( child , child ) name:length
   * or leaf: name:length
   */
  function parseSubtree(str) {
    let s = str;
    let token = nextToken(s);
    s = token.rest;

    if (token.token === '(') {
      const children = [];
      for (;;) {
        const sub = parseSubtree(s);
        children.push(sub.node);
        s = sub.rest;
        token = nextToken(s);
        s = token.rest;
        if (token.token === ')') break;
        if (token.token !== ',') throw new Error('Newick: expected , or )');
      }
      let name = null;
      let branch_length = 0;
      let confidence = null;
      token = nextToken(s);
      s = token.rest;
      if (token.token && token.token !== ',' && token.token !== ';') {
        if (typeof token.token === 'object') {
          name = token.token.label;
          branch_length = token.token.branch_length;
          confidence = token.token.confidence;
        } else {
          name = token.token;
          const lenSupp = parseLengthAndSupport(s);
          branch_length = lenSupp.branch_length;
          confidence = lenSupp.confidence;
          s = lenSupp.rest;
        }
      }
      const node = {
        name: name,
        branch_length: branch_length,
        confidence: confidence,
        clades: children
      };
      return { node, rest: s };
    }

    // leaf: name then optional :length[support]
    let name = null;
    let branch_length = 0;
    let confidence = null;
    if (token.token) {
      if (typeof token.token === 'object') {
        name = token.token.label;
        branch_length = token.token.branch_length;
        confidence = token.token.confidence;
      } else {
        name = token.token;
        const lenSupp = parseLengthAndSupport(token.rest);
        branch_length = lenSupp.branch_length;
        confidence = lenSupp.confidence;
        s = lenSupp.rest;
      }
    }
    const node = {
      name: name,
      branch_length: branch_length,
      confidence: confidence,
      clades: []
    };
    return { node, rest: s };
  }

  /**
   * Parse full Newick string. Root has no branch_length (optional).
   * Returns { root: node } where root is the tree root.
   */
  function parse(newickStr) {
    const s = String(newickStr).trim();
    if (!s.length) throw new Error('Empty Newick string');
    const result = parseSubtree(s);
    let root = result.node;
    let rest = result.rest;
    const token = nextToken(rest);
    if (token.token === ';') rest = token.rest;
    if (root.clades && root.clades.length === 1) {
      const child = root.clades[0];
      root = child;
    }
    return { root, rest };
  }

  global.Newick = { parse, nextToken };
})(typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : this);
