/**
 * Grafo delle dipendenze e ordinamento topologico iterativo.
 * Rilevamento cicli con marcatura #CIRCULAR! isolata.
 * Nessuna ricorsione profonda (garantito per catene di oltre 10.000 celle).
 * Indicizzazione spaziale degli intervalli per evitare esplosione delle celle.
 */

import { CellCoord, RangeCoord, makeCellKey, normalizeSheetName } from './address';
import { ASTNode } from './parser';

export interface RangeSubscription {
  range: RangeCoord;
  dependentKey: string;
}

export class DependencyGraph {
  // Dipendenze dirette cella -> formule che dipendono da essa
  // targetCellKey -> Set(dependentFormulaKey)
  private cellDependents = new Map<string, Set<string>>();

  // Formula -> celle singole da cui dipende
  // formulaKey -> Set(sourceCellKey)
  private formulaSources = new Map<string, Set<string>>();

  // Formula -> intervalli da cui dipende
  // formulaKey -> RangeCoord[]
  private formulaRanges = new Map<string, RangeCoord[]>();

  // Indice spaziale degli intervalli raggruppati per foglio
  // sheet -> RangeSubscription[]
  private sheetRangeIndex = new Map<string, RangeSubscription[]>();

  /**
   * Estrae ricorsivamente (tramite stack iterativo) tutte le celle e gli intervalli citati in un AST.
   */
  public static extractReferencesFromAST(ast: ASTNode, defaultSheet: string): {
    cells: CellCoord[];
    ranges: RangeCoord[];
  } {
    const cells: CellCoord[] = [];
    const ranges: RangeCoord[] = [];
    const stack: ASTNode[] = [ast];

    while (stack.length > 0) {
      const node = stack.pop()!;
      switch (node.type) {
        case 'Cell':
          cells.push({
            ...node.coord,
            sheet: node.coord.sheet || defaultSheet,
          });
          break;
        case 'Range':
          ranges.push({
            ...node.coord,
            sheet: node.coord.sheet || defaultSheet,
          });
          break;
        case 'Unary':
        case 'Postfix':
          stack.push(node.expr);
          break;
        case 'Binary':
          stack.push(node.left);
          stack.push(node.right);
          break;
        case 'Call':
          for (let i = node.args.length - 1; i >= 0; i--) {
            stack.push(node.args[i]);
          }
          break;
      }
    }

    return { cells, ranges };
  }

  /**
   * Aggiorna le dipendenze di una cella formula.
   */
  public setDependencies(
    formulaKey: string,
    sourceCells: CellCoord[],
    sourceRanges: RangeCoord[]
  ): void {
    // 1. Rimuove le vecchie dipendenze
    this.removeDependencies(formulaKey);

    // 2. Registra le nuove celle sorgente
    const cellSet = new Set<string>();
    for (const c of sourceCells) {
      const sKey = makeCellKey(c.sheet || '', c.row, c.col);
      cellSet.add(sKey);

      let deps = this.cellDependents.get(sKey);
      if (!deps) {
        deps = new Set();
        this.cellDependents.set(sKey, deps);
      }
      deps.add(formulaKey);
    }
    this.formulaSources.set(formulaKey, cellSet);

    // 3. Registra i nuovi intervalli
    if (sourceRanges.length > 0) {
      this.formulaRanges.set(formulaKey, sourceRanges);
      for (const rng of sourceRanges) {
        const sheet = normalizeSheetName(rng.sheet || '');
        let list = this.sheetRangeIndex.get(sheet);
        if (!list) {
          list = [];
          this.sheetRangeIndex.set(sheet, list);
        }
        list.push({ range: rng, dependentKey: formulaKey });
      }
    }
  }

  /**
   * Rimuove tutte le dipendenze registrate per una data formula (es. quando la cella viene cancellata).
   */
  public removeDependencies(formulaKey: string): void {
    // Rimuove da cellDependents
    const oldSources = this.formulaSources.get(formulaKey);
    if (oldSources) {
      for (const sKey of oldSources) {
        const deps = this.cellDependents.get(sKey);
        if (deps) {
          deps.delete(formulaKey);
          if (deps.size === 0) {
            this.cellDependents.delete(sKey);
          }
        }
      }
      this.formulaSources.delete(formulaKey);
    }

    // Rimuove da sheetRangeIndex
    const oldRanges = this.formulaRanges.get(formulaKey);
    if (oldRanges) {
      for (const rng of oldRanges) {
        const sheet = normalizeSheetName(rng.sheet || '');
        const list = this.sheetRangeIndex.get(sheet);
        if (list) {
          const filtered = list.filter((sub) => sub.dependentKey !== formulaKey);
          if (filtered.length === 0) {
            this.sheetRangeIndex.delete(sheet);
          } else {
            this.sheetRangeIndex.set(sheet, filtered);
          }
        }
      }
      this.formulaRanges.delete(formulaKey);
    }
  }

  /**
   * Ritorna i dipendenti diretti (di primo livello) di una data cella modificata.
   */
  public getDirectDependents(sheet: string, row: number, col: number): Set<string> {
    const result = new Set<string>();
    const cellKey = makeCellKey(sheet, row, col);

    // 1. Dipendenti da singola cella
    const singleDeps = this.cellDependents.get(cellKey);
    if (singleDeps) {
      for (const k of singleDeps) {
        result.add(k);
      }
    }

    // 2. Dipendenti da intervallo
    const normSheet = normalizeSheetName(sheet);
    const rangeList = this.sheetRangeIndex.get(normSheet);
    if (rangeList) {
      for (const sub of rangeList) {
        const rng = sub.range;
        if (
          row >= rng.startRow &&
          row <= rng.endRow &&
          col >= rng.startCol &&
          col <= rng.endCol
        ) {
          result.add(sub.dependentKey);
        }
      }
    }

    return result;
  }

  /**
   * Calcola l'ordine topologico iterativo di ricalcolo a partire da un insieme di celle modificate.
   * Rileva i cicli con l'algoritmo di Tarjan iterativo:
   * Le celle appartenenti a un ciclo vengono restituite nel set `circularKeys`.
   * Le celle libere da cicli vengono restituite ordinate topologicamente in `evaluationOrder`.
   */
  public getTopologicalOrder(modifiedKeys: Iterable<string>): {
    evaluationOrder: string[];
    circularKeys: Set<string>;
  } {
    // 1. Trova tutti i discendenti raggiungibili (chiusura transitiva iterativa via BFS)
    const reachable = new Set<string>();
    const queue: string[] = [];

    for (const key of modifiedKeys) {
      // Per ogni cella modificata, trova i suoi dipendenti diretti
      const [sh, rStr, cStr] = key.split(/!|:/);
      const direct = this.getDirectDependents(sh, parseInt(rStr, 10), parseInt(cStr, 10));
      for (const d of direct) {
        if (!reachable.has(d)) {
          reachable.add(d);
          queue.push(d);
        }
      }
    }

    let head = 0;
    while (head < queue.length) {
      const curr = queue[head++];
      const [sh, rStr, cStr] = curr.split(/!|:/);
      const nextDeps = this.getDirectDependents(sh, parseInt(rStr, 10), parseInt(cStr, 10));
      for (const nd of nextDeps) {
        if (!reachable.has(nd)) {
          reachable.add(nd);
          queue.push(nd);
        }
      }
    }

    if (reachable.size === 0) {
      return { evaluationOrder: [], circularKeys: new Set() };
    }

    // 2. Costruzione del sottografo tra i nodi raggiungibili
    const adj = new Map<string, Set<string>>();
    for (const u of reachable) {
      const [sh, rStr, cStr] = u.split(/!|:/);
      const deps = this.getDirectDependents(sh, parseInt(rStr, 10), parseInt(cStr, 10));
      const filtered = new Set<string>();
      for (const v of deps) {
        if (reachable.has(v)) {
          filtered.add(v);
        }
      }
      adj.set(u, filtered);
    }

    // 3. Rilevamento cicli tramite Tarjan SCC iterativo
    const circularKeys = new Set<string>();
    const sccs = this.tarjanSCCIterative(reachable, adj);

    for (const scc of sccs) {
      if (scc.length > 1) {
        for (const node of scc) {
          circularKeys.add(node);
        }
      } else if (scc.length === 1) {
        // Autociclo (es. A1 = A1 + 1)
        const single = scc[0];
        const neighbors = adj.get(single);
        if (neighbors && neighbors.has(single)) {
          circularKeys.add(single);
        }
      }
    }

    // Anche i nodi che dipendono da una cella circolare devono essere valutati (riceveranno #CIRCULAR! o errore)
    // 4. Ordinamento topologico dei nodi validi tramite algoritmo di Kahn iterativo
    // Calcolo in-degree nel sottografo
    const inDegree = new Map<string, number>();
    for (const u of reachable) {
      if (!inDegree.has(u)) inDegree.set(u, 0);
      const neighbors = adj.get(u);
      if (neighbors) {
        for (const v of neighbors) {
          inDegree.set(v, (inDegree.get(v) || 0) + 1);
        }
      }
    }

    const topoQueue: string[] = [];
    for (const [node, deg] of inDegree.entries()) {
      if (deg === 0 && !circularKeys.has(node)) {
        topoQueue.push(node);
      }
    }

    const evaluationOrder: string[] = [];
    const evalOrderSet = new Set<string>();
    let topoHead = 0;
    while (topoHead < topoQueue.length) {
      const u = topoQueue[topoHead++];
      evaluationOrder.push(u);
      evalOrderSet.add(u);
      const neighbors = adj.get(u);
      if (neighbors) {
        for (const v of neighbors) {
          if (circularKeys.has(v)) continue;
          const currentDeg = inDegree.get(v)! - 1;
          inDegree.set(v, currentDeg);
          if (currentDeg === 0) {
            topoQueue.push(v);
          }
        }
      }
    }

    // Eventuali nodi rimanenti non ordinati che non erano già in circularKeys
    // possono essere cicli complessi o dipendenti bloccati (O(1) con Set)
    for (const u of reachable) {
      if (!circularKeys.has(u) && !evalOrderSet.has(u)) {
        circularKeys.add(u);
      }
    }

    return { evaluationOrder, circularKeys };
  }

  /**
   * Calcola l'ordine topologico iterativo per tutte le formule fornite (es. ricalcolo completo del Workbook).
   */
  public getFullTopologicalOrder(formulaKeys: Iterable<string>): {
    evaluationOrder: string[];
    circularKeys: Set<string>;
  } {
    const reachable = new Set<string>(formulaKeys);
    if (reachable.size === 0) {
      return { evaluationOrder: [], circularKeys: new Set() };
    }

    const adj = new Map<string, Set<string>>();
    for (const u of reachable) {
      const [sh, rStr, cStr] = u.split(/!|:/);
      const deps = this.getDirectDependents(sh, parseInt(rStr, 10), parseInt(cStr, 10));
      const filtered = new Set<string>();
      for (const v of deps) {
        if (reachable.has(v)) {
          filtered.add(v);
        }
      }
      adj.set(u, filtered);
    }

    const circularKeys = new Set<string>();
    const sccs = this.tarjanSCCIterative(reachable, adj);
    for (const scc of sccs) {
      if (scc.length > 1) {
        for (const node of scc) {
          circularKeys.add(node);
        }
      } else if (scc.length === 1) {
        const single = scc[0];
        const neighbors = adj.get(single);
        if (neighbors && neighbors.has(single)) {
          circularKeys.add(single);
        }
      }
    }

    const inDegree = new Map<string, number>();
    for (const u of reachable) {
      if (!inDegree.has(u)) inDegree.set(u, 0);
      const neighbors = adj.get(u);
      if (neighbors) {
        for (const v of neighbors) {
          inDegree.set(v, (inDegree.get(v) || 0) + 1);
        }
      }
    }

    const topoQueue: string[] = [];
    for (const [node, deg] of inDegree.entries()) {
      if (deg === 0 && !circularKeys.has(node)) {
        topoQueue.push(node);
      }
    }

    const evaluationOrder: string[] = [];
    const evalOrderSet = new Set<string>();
    let topoHead = 0;
    while (topoHead < topoQueue.length) {
      const u = topoQueue[topoHead++];
      evaluationOrder.push(u);
      evalOrderSet.add(u);
      const neighbors = adj.get(u);
      if (neighbors) {
        for (const v of neighbors) {
          if (circularKeys.has(v)) continue;
          const currentDeg = inDegree.get(v)! - 1;
          inDegree.set(v, currentDeg);
          if (currentDeg === 0) {
            topoQueue.push(v);
          }
        }
      }
    }

    for (const u of reachable) {
      if (!circularKeys.has(u) && !evalOrderSet.has(u)) {
        circularKeys.add(u);
      }
    }

    return { evaluationOrder, circularKeys };
  }

  /**
   * Implementazione rigorosamente iterativa dell'algoritmo di Tarjan per SCC.
   * Evita stack overflow su grafi arbitrariamente profondi (10.000+ nodi).
   */
  private tarjanSCCIterative(nodes: Set<string>, adj: Map<string, Set<string>>): string[][] {
    let index = 0;
    const indices = new Map<string, number>();
    const lowlink = new Map<string, number>();
    const onStack = new Set<string>();
    const S: string[] = [];
    const sccs: string[][] = [];

    for (const root of nodes) {
      if (indices.has(root)) continue;

      // Stack di chiamata iterativo
      // Memorizza [u, iterator dei vicini]
      interface Frame {
        u: string;
        neighbors: string[];
        nextNeighborIdx: number;
      }

      const callStack: Frame[] = [];

      indices.set(root, index);
      lowlink.set(root, index);
      index++;
      S.push(root);
      onStack.add(root);

      const rootNeighbors = Array.from(adj.get(root) || []);
      callStack.push({ u: root, neighbors: rootNeighbors, nextNeighborIdx: 0 });

      while (callStack.length > 0) {
        const frame = callStack[callStack.length - 1];
        const u = frame.u;

        if (frame.nextNeighborIdx < frame.neighbors.length) {
          const v = frame.neighbors[frame.nextNeighborIdx++];

          if (!indices.has(v)) {
            // Visita v
            indices.set(v, index);
            lowlink.set(v, index);
            index++;
            S.push(v);
            onStack.add(v);

            const vNeighbors = Array.from(adj.get(v) || []);
            callStack.push({ u: v, neighbors: vNeighbors, nextNeighborIdx: 0 });
          } else if (onStack.has(v)) {
            const currentLow = lowlink.get(u)!;
            const vIndex = indices.get(v)!;
            if (vIndex < currentLow) {
              lowlink.set(u, vIndex);
            }
          }
        } else {
          // Tutti i vicini di u sono stati processati
          callStack.pop();

          if (callStack.length > 0) {
            const parentFrame = callStack[callStack.length - 1];
            const p = parentFrame.u;
            const pLow = lowlink.get(p)!;
            const uLow = lowlink.get(u)!;
            if (uLow < pLow) {
              lowlink.set(p, uLow);
            }
          }

          if (lowlink.get(u) === indices.get(u)) {
            const scc: string[] = [];
            while (true) {
              const w = S.pop()!;
              onStack.delete(w);
              scc.push(w);
              if (w === u) break;
            }
            sccs.push(scc);
          }
        }
      }
    }

    return sccs;
  }
}
