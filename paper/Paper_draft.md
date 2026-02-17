---
title: "From Overwhelm to Construction: A Systems-Gamified City-Builder Metaphor for Executive-Function Support in ADHD (Hyperfocus) and Autism"
author: "Nicolas Pepin"
date: "2026-01-20"
---

## Abstract

Difficulties with planning, prioritization, and task initiation - core facets of executive function (EF) - are common in attention-deficit/hyperactivity disorder (ADHD) and autism spectrum disorder (ASD). Conventional productivity tools frequently encode work as decontextualized lists, which can amplify overwhelm and reduce motivation for individuals whose engagement is strongly interest-contingent and whose EF resources are constrained. This paper advances a conceptual and design framework for **CityLife**, an isometric “city-builder” that doubles as a life-planning simulator in which commitments are represented as buildings, dependencies/effort pathways are represented as roads, and key outcomes are tracked as a coupled system of **Income**, **Happiness**, and **Wellness**. [CityLife Design Docs, attached]

We synthesize constructs from distributed cognition, cognitive offloading, the extended mind, self-determination theory, flow theory, and contemporary EF literatures in ADHD and ASD to argue that the CityLife metaphor can function as a *bridge* from real-world overwhelm and perceived boredom to an intrinsically motivating “world of challenge and construction.” The metaphor is especially promising for (a) **ADHD with prominent hyperfocus**, by converting planning into a flow-eligible optimization and construction task with immediate feedback, and (b) **ASD**, by leveraging strengths in systematizing, predictability, and visual-spatial reasoning while providing explicit scaffolds for organization. We propose mechanistic hypotheses, neurodivergent-affirming design principles, and a research agenda for empirical validation.

**Keywords:** executive function; ADHD; autism; hyperfocus; metaphor; gamification; cognitive offloading; distributed cognition; planning tools; serious games

---

## 1. Introduction

Executive functions coordinate goal-directed behavior by supporting planning, inhibition, working memory, task switching, and self-monitoring. EF difficulties are highly prevalent in both ADHD and ASD, and are frequently experienced as problems with organization, initiating tasks, maintaining routines, and managing transitions. [Barkley, 1997; Demetriou et al., 2018] These difficulties intersect with motivational dynamics: many individuals with ADHD report that attention is not globally absent but strongly influenced by interest, urgency, novelty, and immediate feedback, producing the apparent paradox of “can’t start” alongside episodes of intense absorption (hyperfocus). [Ashinoff & Abu-Akel, 2021; Hupfeld et al., 2019] In autism, focused interests and higher costs of shifting attention across contexts are emphasized in accounts such as monotropism, which frames autism partly as a distinctive strategy for allocating limited attentional resources. [Murray et al., 2005]

The representational format of planning tools matters. Flat lists can collapse diverse obligations into a homogeneous queue, making priorities and dependencies harder to perceive and increasing working-memory demands during re-planning. CityLife begins from a different premise: rather than encoding life as a list, it encodes it as a **spatial system** where commitments are “buildings” (nodes), dependencies and effort pathways are “roads,” and the user maintains balance across **Income, Happiness, and Wellness** rather than maximizing a single metric. [CityLife Design Docs, attached] This reframing is not merely aesthetic: it instantiates formal rules - e.g., influence decays with *shortest road distance*; buildings contribute only when “active”; and relationships are inspectable as a graph - that may reduce EF load and support motivation through game-like construction.

This paper provides a journal-ready conceptual analysis of CityLife-like metaphors as EF scaffolds for ADHD (hyperfocusing type) and ASD. We (i) describe the CityLife representational commitments, (ii) ground the approach in cognitive and motivational theory, (iii) specify why it may be particularly effective for ADHD hyperfocus and autism-related EF challenges, (iv) translate clinical EF-support principles into concrete design requirements, and (v) outline testable hypotheses and study designs.

---

## 2. The City-Builder Metaphor as a Formal External Representation

### 2.1 Core representational commitments

CityLife treats life planning as “a calm, technical instrument panel: a spatial model of your life where you can iterate quickly, inspect causality, and tune assumptions.” [CityLife Design Docs, attached] It operationalizes this via:

- **Nodes as commitments:** “Buildings are nodes (tasks, projects, habits, routines).” [CityLife Design Docs, attached]  
- **Edges as pathways:** “Roads are dependencies/commute/effort pathways that enable activities to influence one another.” [CityLife Design Docs, attached]  
- **Distance-weighted interaction:** “The shortest road distance between nodes defines how strongly they interact.” [CityLife Design Docs, attached]  
- **Balance as objective:** “Maintain sustainable life balance rather than maximize a single metric.” [CityLife Design Docs, attached]  

A critical additional constraint is **activation gating**: “A building is Active only if orthogonally adjacent to at least one road tile.” [CityLife Design Docs, attached] This gate shapes both simulation contributions and the relationship graph. [CityLife Design Docs, attached]

These commitments map naturally onto real-world task dynamics. A commitment that is conceptually important but lacks enabling conditions (time, tools, prerequisites, social coordination) is analogous to an unconnected building: it exists, but is not operational. A system that makes this distinction visible can reduce self-blame and reframe “not doing” as “not yet connected.”

### 2.2 A lightweight systems model and explainable causality

CityLife formalizes the city as a weighted influence network with an exponential distance falloff:

$$w_{ij} =
\begin{cases}
a_i a_j \cdot \exp\left(-\frac{d_{ij}}{\lambda}\right) & d_{ij} \le d_{\max} \\
0 & \text{otherwise}
\end{cases}$$

where distance $d_{ij}$ is defined by BFS shortest path through road tiles (no Euclidean fallback). [CityLife Design Docs, attached] [CityLife Design Docs, attached] Node (building) and pairwise (edge) effects aggregate into a bounded metric vector $\mathbf{M}=[I,H,W]^\top$. [CityLife Design Docs, attached]

The design explicitly supports “systems analysis” via a graph view to “inspect influence pathways and key bottlenecks.” [CityLife Design Docs, attached] A roadmap goal for advisor explainability is to have recommendations cite contributing graph paths and terms. [CityLife Design Docs, attached] In EF support contexts, such causal legibility is not a luxury: interpretability reduces cognitive load, helps users form accurate mental models, and enables clinician-user collaboration.

---

## 3. Theoretical Foundations

### 3.1 Executive function in ADHD and ASD

A prominent theoretical account of ADHD frames core symptoms as impairments in behavioral inhibition and self-regulation, with downstream impacts on working memory, planning, and sustained goal pursuit (Barkley, 1997). [Barkley, 1997] These EF-related difficulties are central to many functional impairments in adult ADHD, and CBT-based interventions often target organization, planning, and adaptive thinking explicitly. [Safren et al., 2005]

In ASD, EF differences are similarly common. A large meta-analysis reported moderate overall EF differences across domains in ASD and noted that behavioral/informant EF measures often show substantial heterogeneity. [Demetriou et al., 2018] Related reviews emphasize that EF profiles interact with measurement and heterogeneity across the spectrum. [Demetriou et al., 2019] EF profiles can also differ across neurodevelopmental disorders, reinforcing the importance of flexible, individualized scaffolding rather than one-size-fits-all workflows. [Ozonoff & Jensen, 1999]

### 3.2 Distributed cognition, the extended mind, and cognitive offloading

Distributed cognition proposes that cognitive processes are realized through interactions with external artifacts and representations (Hutchins, 1995). [Hutchins, 1995] The extended mind thesis argues that some external resources can become functionally integrated into cognition, acting as parts of a cognitive system rather than mere aids (Clark & Chalmers, 1998). [Clark & Chalmers, 1998]

Cognitive offloading research shows that people routinely use external structures (notes, reminders, saved files, spatial arrangements) to reduce cognitive demand and reallocate limited internal resources; a key review characterizes offloading as “using the outside world to save on brainpower” and details mechanisms and tradeoffs (Risko & Gilbert, 2016). [citation] For ADHD and ASD, where organization and working-memory constraints can be especially costly, high-quality external structure is plausibly compensatory - particularly when it is *persistent, manipulable, and rule-governed*.

### 3.3 Motivation: self-determination, flow, and hyperfocus

Self-determination theory (SDT) posits that intrinsic motivation is supported by autonomy, competence, and relatedness (Deci & Ryan, 2000). [Deci & Ryan, 2000] Flow theory describes deep absorption when perceived challenge matches skill, goals are clear, and feedback is immediate (Csikszentmihalyi, 1990). [Csikszentmihalyi, 1990]

“Hyperfocus” is frequently mentioned in ADHD and autism contexts, yet definitions have historically been inconsistent. A review provides a testable definition and argues that hyperfocus may be closely related to flow, particularly emphasizing engagement, intense sustained attention, reduced perception of non-task stimuli, and improved task performance. [Ashinoff & Abu-Akel, 2021] Empirical work in adults with ADHD also documents hyperfocus experiences and introduces measurement (Adult Hyperfocus Questionnaire). [Hupfeld et al., 2019] Taken together, these literatures justify a design aim: **make planning itself flow-eligible**, so that attentional dynamics that often impair list-based planning can instead be harnessed for construction and systems thinking.

---

## 4. Why the Metaphor May Fit ADHD (Hyperfocusing Type) and ASD

### 4.1 ADHD: converting planning into a compelling construction problem

For many with ADHD, “organizational” work can feel cognitively unrewarding, especially when it is abstract, delayed-reward, and lacking immediate feedback. City-building reframes planning as:

1. **Concrete manipulation:** placing, moving, and connecting items changes the system in visible ways. [CityLife Design Docs, attached]  
2. **Immediate feedback:** changes affect the network and its metrics in real time, supporting rapid hypothesis testing and reinforcing competence. [CityLife Design Docs, attached]  
3. **Multi-objective challenge:** balancing Income/Happiness/Wellness sets up tradeoffs and optimization - conditions that often elicit sustained engagement. [CityLife Design Docs, attached]  

This aligns with hyperfocus/flow accounts emphasizing that deep absorption emerges when tasks are engaging and provide clear feedback. [Ashinoff & Abu-Akel, 2021; Hupfeld et al., 2019] The metaphor thus offers a plausible bridge from “boredom” to a personally fascinating internal world of challenge and construction.

A distinctive EF advantage comes from **activation gating**: a building is active only when adjacent to roads. [CityLife Design Docs, attached] For ADHD, initiation failures often reflect hidden dependencies (“I can’t start because I don’t know the first step,” “I’m missing a prerequisite,” “the task is too big”). Road adjacency gives a *binary readiness signal*: if it is not connected, the task is not yet in an executable state, and the next step is to “build the road” (define the dependency chain), not to force execution.

### 4.2 ASD: predictability, monotropism, and explicit scaffolding for organization

Monotropism characterizes autism partly as a tendency toward concentrated attention on a narrow range of interests, with higher costs for shifting attention among tasks and contexts. [Murray et al., 2005] A city-builder metaphor can align with this by letting users work in stable “districts,” maintain persistent representations, and use the graph as an external map that reduces the need for frequent context switching.

EF differences in autism are well-supported in meta-analytic work, though heterogeneity is substantial. [Demetriou et al., 2018] Importantly, many autism EF supports emphasize explicit scripts, visual cueing, and structured practice. In a randomized effectiveness trial, the Unstuck and On Target intervention targeted flexibility, goal-setting, and planning via cognitive-behavioral methods and visual/verbal cueing. [Kenworthy et al., 2014] CityLife’s design naturally affords these principles:

- **Visual persistence:** tasks are “there” as buildings; dependencies are “there” as roads.  
- **Rule clarity:** activation gating and distance-defined influence reduce ambiguity and make consequences interpretable. [CityLife Design Docs, attached]  
- **Scriptable routines:** the planned “maintenance/decay” loop can represent recurring obligations and recovery as explicit maintenance actions and condition levels. [CityLife Design Docs, attached]  

Thus, the metaphor can be neurodivergent-affirming by turning “organization” into a learnable system with explicit, stable rules - while still allowing customization to fit individual profiles.

---

## 5. Proposed Mechanisms of Action

We propose four mechanisms by which CityLife-like metaphors may reduce overwhelm and improve organization.

### 5.1 Externalizing executive control via cognitive offloading

A spatial city and graph externalize working-memory-intensive operations: tracking dependencies, balancing goals, and maintaining context. Distributed cognition and cognitive offloading accounts predict that such externalization can reduce internal cognitive demand and enable better allocation of attention. [Hutchins, 1995; Risko & Gilbert, 2016]

### 5.2 Making readiness and prerequisites perceptually obvious

Activation gating encodes the difference between “I want to do this” and “this is executable now.” [CityLife Design Docs, attached] Shortest-path distance encodes “effort cost” and “support availability” in a way that can be inspected. [CityLife Design Docs, attached] This supports better sequencing and reduces failures driven by missing prerequisites.

### 5.3 Reframing motivation via competence and autonomy loops

SDT predicts that autonomy and competence support intrinsic motivation. [Deci & Ryan, 2000] City-building is inherently autonomy-supportive (users choose layouts and experiments) and competence-supportive (mastery of a system with meaningful feedback). The roadmap’s multi-persona advisor concept (Income/Happiness/Wellness/Moderator) can be designed to preserve autonomy and avoid shame, while offering structured choices and explainable rationales grounded in the graph. [CityLife Design Docs, attached]

### 5.4 Redirecting hyperfocus/flow toward constructive planning

When hyperfocus and flow are driven by engagement, challenge, and feedback, making planning into a construction/optimization task can channel deep focus into building a plan that reduces friction for real-world action. [Ashinoff & Abu-Akel, 2021; Hupfeld et al., 2019] Importantly, this does not assume hyperfocus is “good” or “bad”; rather, the system aims to *shape its object* and to add guardrails so absorption does not displace essential self-care.

---

## 6. Neurodivergent-Affirming Design Principles

### 6.1 A high-structure pipeline: capture → construct → connect → commit

To bridge real-world overwhelm into an engaging internal world, the tool should provide a structured intake:

1. **Capture (low friction):** a single inbox (voice/text) that does not require immediate categorization.  
2. **Construct (guided mapping):** wizard-based mapping from inbox items to building categories (e.g., work, leisure, health, development) with defaults and “unsure” options. [CityLife Design Docs, attached]  
3. **Connect (explicit prerequisites):** road construction as dependency encoding; the activation gate makes “ready to execute” visible. [CityLife Design Docs, attached]  
4. **Commit (action extraction):** each active building yields a single “next action” and an implementation intention (if-then plan) to support initiation (Gollwitzer, 1999). [Gollwitzer, 1999]  

### 6.2 Multi-view consistency: spatial city + relationship graph + kanban/gantt

CityLife’s roadmap anticipates Kanban and Gantt views derived from the same underlying task objects, preserving a single source of truth. [CityLife Design Docs, attached] Consistency across views matters clinically: translation costs between systems constitute an EF tax. Users should be able to choose the view that best matches their cognition (visual-spatial, list-based, time-based) without duplicating work.

### 6.3 Clinical alignment with evidence-based skills training

Adult ADHD CBT programs include structured training in organization and planning. [Safren et al., 2005] Meta-cognitive therapy (MCT) for adults with ADHD explicitly targets time management, organizational, and planning skills and has evidence of efficacy relative to supportive therapy. [Solanto et al., 2010] CityLife can serve as an experiential “practice field” for these skills with clinician-guided assignments, for example:

- Build a “minimum viable week” district (sleep, meals, movement, admin).  
- Identify bottlenecks in the relationship graph and test two small edits; predict and then observe metric changes. [CityLife Design Docs, attached]  
- Use maintenance/decay to represent routine upkeep and recovery loops, reframing lapses as system maintenance rather than personal failure. [CityLife Design Docs, attached]  

### 6.4 Guardrails against compulsive optimization, perfectionism, and shame

Gamification can backfire if it encourages perfectionism, compulsive optimization, or punitive feedback. CityLife’s intent is explicitly “calm” and “technical,” suggesting a design stance closer to reflective instrumentation than coercive scoring. [CityLife Design Docs, attached] Recommended guardrails:

- Emphasize **trends** and **ranges** over hard grades.  
- Offer “good enough” presets and avoid streak-based punishment.  
- Use shame-free labels (e.g., “inactive / needs connection” rather than “failed”).  
- Make advisor notifications optional, non-intrusive, and user-controlled (mute, thresholds). [CityLife Design Docs, attached]  

### 6.5 Privacy and autonomy, especially for agentic/LLM features

If LLM advisors are incorporated, explicit consent and local-only options are essential. CityLife’s roadmap specifies privacy-first behavior and user consent before sending data externally. [CityLife Design Docs, attached] For clinical contexts, data minimization and clear boundaries around sensitive information are non-negotiable.

---

## 7. Research Agenda and Testable Hypotheses

### 7.1 Hypotheses

**H1 (Externalization):** Compared with a best-in-class list-based task manager, CityLife-style spatial/graph planning will reduce perceived overload and improve task initiation in adults with ADHD and/or ASD, mediated by reduced working-memory demands (cognitive offloading). [Risko & Gilbert, 2016]

**H2 (Hyperfocus engagement):** Among ADHD participants with frequent hyperfocus, CityLife will increase engagement with planning activities and adherence to planning routines by making planning itself flow-eligible. [Ashinoff & Abu-Akel, 2021; Hupfeld et al., 2019]

**H3 (Rule clarity for ASD):** Among ASD participants, CityLife combined with a scripted intake process will improve organization and goal tracking, supported by predictability (activation gating; distance-defined influence) and reduced context switching. [Murray et al., 2005; Demetriou et al., 2018]

### 7.2 Study designs

- **Randomized controlled trial (8–12 weeks):** CityLife vs. list-based app with matched onboarding. Outcomes: BRIEF-A, perceived overwhelm, initiation latency, completion rate, and wellbeing measures.  
- **Micro-randomized trial:** Compare just-in-time prompts (“connect the building” vs. “choose next action”) and their effects on same-day initiation.  
- **Qualitative mechanistic study:** Think-aloud comparison of how participants represent dependencies, prioritize, and recover from derailments in each tool.

### 7.3 Instrumentation opportunities

The explicit graph yields interpretable trace data: activation status (road adjacency), node centrality (bottlenecks), and distance-weighted clusters. With ethical safeguards, these signals could help personalize scaffolds (e.g., recommend building “roads” where dependencies are missing) and support clinician-user collaboration by providing shared, explainable artifacts.

---

## 8. Limitations

This paper is conceptual and requires empirical validation. Metaphors can mismatch user preferences; some individuals may find city-building visually overwhelming or may prefer simpler representations. Neurodivergent populations are heterogeneous, and co-design with ADHD and autistic communities is necessary to ensure accessibility, avoid coercive gamification, and adopt neurodivergent-affirming language and framing.

---

## 9. Conclusion

CityLife exemplifies a shift from list-centric productivity toward **metaphor-driven external cognition**: a constrained, legible world where tasks become buildings, dependencies become roads, and balance is maintained across multiple life metrics. [CityLife Design Docs, attached] By integrating EF theory, cognitive offloading, and motivation/flow research, we argue that city-builder metaphors may offer a uniquely effective bridge for ADHD (hyperfocusing type) and ASD users - translating real-world overwhelm into an internally compelling world of challenge and construction where organization is concrete, inspectable, and learnable.

---

## References

CityLife Design Docs (attached). *CityLife specification and implementation roadmap* (files provided by user: AGENTS.md; README.md).

Ashinoff, B. K., & Abu-Akel, A. (2021). Hyperfocus: The forgotten frontier of attention. *Psychological Research, 85*, 1–19. https://doi.org/10.1007/s00426-019-01245-8 [Ashinoff & Abu-Akel, 2021]

Barkley, R. A. (1997). Behavioral inhibition, sustained attention, and executive functions: Constructing a unifying theory of ADHD. *Psychological Bulletin, 121*(1), 65–94. [Barkley, 1997]

Clark, A., & Chalmers, D. (1998). The extended mind. *Analysis, 58*(1), 7–19. [Clark & Chalmers, 1998]

Csikszentmihalyi, M. (1990). *Flow: The psychology of optimal experience*. Harper & Row. [Csikszentmihalyi, 1990]

Deci, E. L., & Ryan, R. M. (2000). The “what” and “why” of goal pursuits: Human needs and the self-determination of behavior. *Psychological Inquiry, 11*(4), 227–268. [Deci & Ryan, 2000]

Demetriou, E. A., Lampit, A., Quintana, D. S., Naismith, S. L., Song, Y. J. C., Pye, J. E., Hickie, I., & Guastella, A. J. (2018). Autism spectrum disorders: A meta-analysis of executive function. *Molecular Psychiatry, 23*, 1198–1204. https://doi.org/10.1038/mp.2017.75 [Demetriou et al., 2018]

Demetriou, E. A., DeMayo, M. M., & Guastella, A. J. (2019). Executive function in autism spectrum disorder: History, theoretical models, empirical findings, and potential as an endophenotype. *Frontiers in Psychiatry, 10*, 753. https://doi.org/10.3389/fpsyt.2019.00753 [Demetriou et al., 2019]

Gollwitzer, P. M. (1999). Implementation intentions: Strong effects of simple plans. *American Psychologist, 54*(7), 493–503. [Gollwitzer, 1999]

Hupfeld, K. E., Abagis, T. R., & Shah, P. (2019). Living “in the zone”: Hyperfocus in adult ADHD. *Attention Deficit and Hyperactivity Disorders*. [Hupfeld et al., 2019]

Hutchins, E. (1995). *Cognition in the wild*. MIT Press. [Hutchins, 1995]

Kenworthy, L., Anthony, L. G., Naiman, D. Q., Cannon, L., Wills, M. C., Werner, M. A., Alexander, K., Strang, J., Bal, E., Sokoloff, J. L., & Wallace, G. L. (2014). Randomized controlled effectiveness trial of executive function intervention for children on the autism spectrum. *Journal of Child Psychology and Psychiatry, 55*, 374–383. https://doi.org/10.1111/jcpp.12161 [Kenworthy et al., 2014]

Murray, D., Lesser, M., & Lawson, W. (2005). Attention, monotropism and the diagnostic criteria for autism. *Autism, 9*(2), 139–156. https://doi.org/10.1177/1362361305051398 [Murray et al., 2005]

Ozonoff, S., & Jensen, J. (1999). Brief report: Specific executive function profiles in three neurodevelopmental disorders. *Journal of Autism and Developmental Disorders, 29*, 171–177. https://doi.org/10.1023/A:1023052913110 [Ozonoff & Jensen, 1999]

Risko, E. F., & Gilbert, S. J. (2016). Cognitive offloading. *Trends in Cognitive Sciences, 20*(9), 676–688. https://doi.org/10.1016/j.tics.2016.07.002 [Risko & Gilbert, 2016]

Safren, S. A., Perlman, C. A., Sprich, S., & Otto, M. W. (2005). Psychoeducation and introduction to organization and planning skills. In *Mastering your adult ADHD: A cognitive-behavioral treatment program (Therapist Guide)* (pp. 17–30). Oxford University Press. https://doi.org/10.1093/med:psych/9780195188189.003.0001 [Safren et al., 2005]

Solanto, M. V., Marks, D. J., Wasserstein, J., Mitchell, K., & Abikoff, H. (2010). Efficacy of meta-cognitive therapy for adult ADHD. *American Journal of Psychiatry, 167*(8), 958–968. [Solanto et al., 2010]
