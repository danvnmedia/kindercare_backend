---
id: th1py7
title: Co-locate port-method removal with sole-consumer removal
layer: project
category: pattern
tags:
  - clean-architecture
  - refactor
  - spec-sequencing
  - ports
createdAt: '2026-05-06T02:36:52.486Z'
updatedAt: '2026-05-06T02:36:52.486Z'
---

When a spec sequences "remove method from repository port" before "remove the use case that consumed it", the literal ordering breaks the build between merges. Resolution: bring the consumer-removal forward into the port-removal task so the contract change is atomic. The downstream task that "introduces the replacement use case" then becomes purely additive.

Example: spec `class-enrollment-period-model` placed `delete()` removal in `jvdbpl` (repo task) and `UnenrollStudentUseCase` removal in `q0oqvy` (use-case task). Implementing them as written would have left `jvdbpl` with a TS error. Resolution in `jvdbpl`: deleted the use case + DELETE HTTP route + DI provider alongside the port methods. `q0oqvy` reduced to "add `WithdrawStudentUseCase` + new POST route".

Heuristic: if a port method has only one production caller and that caller is also being removed by the same spec, treat them as one atomic change in whichever task lands first. Surface the decision to the user in the plan before implementing.
