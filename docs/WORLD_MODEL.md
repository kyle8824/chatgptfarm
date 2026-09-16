# ChatGPTFarm World Model

## Core invariant

**The environment exists as simulation state first. Rendering is a view of that state.**

A visually significant thing should not exist only as scenery. If the viewer shows a persistent creek, tree, vessel, structure, tool, remnant, trail or other consequential feature, there should be a corresponding world entity or environmental field in canonical state.

## Two kinds of reality

### Objects
Discrete things with persistent identity:

- terrain features and places when they matter as interaction targets
- trees, branches, rocks, plants, structures
- agents and animals
- tools, vessels, remnants and manufactured objects

Objects can carry:

- unique ID
- type/kind
- coordinates and geometry
- physical properties
- material properties
- mutable state
- parent/child relationships
- resolution level
- provenance
- event history

### Fields
Continuous or zonal environmental conditions:

- temperature
- precipitation
- humidity
- light
- wind
- soil moisture
- water depth

Objects are affected by fields. Example: rain raises environmental moisture; exposed wooden objects become wetter; weather-sensitive tracks lose clarity.

## Progressive resolution

Do not instantiate every twig, stone or berry at world creation.

Environmental objects can start at aggregate resolution. Detail is materialized when observation or interaction requires it.

Example:

`fallen oak -> close inspection -> trunk + branch components -> cut branch -> independent persistent branch`

The detached branch keeps its identity and inherited material properties. Its relationship to the original tree remains in provenance/history.

This is the preferred way for the world to become richer over time.

## Property-derived affordances

Avoid hidden technology trees and object-specific action menus where physical properties can support the behavior instead.

Examples:

- wood + cuttable -> cutting/shaping can be attempted
- hard + impact-capable -> striking can be attempted
- fibrous + flexible -> twisting/binding can be attempted
- clay + plastic/moldable -> shaping can be attempted

The model may propose an experiment; the physics layer decides whether it works.

## Conservation and provenance

When an object splits, combines or transforms, preserve enough lineage to answer where the resulting thing came from.

Future target:

`TREE-017 -> BRANCH-003 -> WORKED-POLE-002 -> COMPOSITE-TOOL-001`

The world should support archaeology: an observer should eventually be able to inspect an old object and reconstruct its physical history.

## Renderer rule

The renderer must not become a second source of truth.

- coordinates come from world state
- geometry comes from world state or a deterministic visual interpretation of it
- active/inactive state comes from world state
- weather visuals come from environmental fields
- structures/artifacts appear because the corresponding entities exist
- visible changes should be consequences of canonical state changes

Decorative art is allowed for texture and atmosphere, but it must not imply consequential objects or events that do not exist in simulation state.

## Compatibility period

The legacy `resources` / `structures` aggregates remain temporarily because older survival and action code depends on them. v0.7 mirrors those values into persistent world entities while interaction gradually moves to the object model.

The direction is one-way: new systems should prefer `worldModel`; legacy aggregates should become compatibility projections and eventually disappear as authoritative state.
