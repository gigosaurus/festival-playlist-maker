# Project standards

These standards apply to every change to this project. They apply to interface text, error messages, documentation, code comments, commit messages and pull request descriptions.

A change is complete only when it conforms to these standards and the audit record is up to date (see [Process](#5-process)).

## 1. Standard Technical English

All text in the project shall use Standard Technical English (STE), based on ASD-STE100. The project applies these rules:

| Rule | Requirement |
|---|---|
| STE-01 | Use one word for one meaning. Use the terms in the [glossary](#glossary) and do not use synonyms for them. |
| STE-02 | Keep procedural sentences (instructions) to 20 words or fewer. Keep descriptive sentences to 25 words or fewer. |
| STE-03 | Write one instruction in each sentence. Write instructions in the imperative ("Select a file."). |
| STE-04 | Use the active voice. Use the simple present, simple past or simple future tense. |
| STE-05 | Do not use contractions ("do not", not "don't"). |
| STE-06 | Do not use phrasal verbs or idioms when a direct verb is available ("publish", not "go out"). |
| STE-07 | Do not use noun clusters of more than three words. |
| STE-08 | Put a warning or a condition before the instruction that it applies to. |
| STE-09 | Keep paragraphs to six sentences or fewer. Each paragraph has one topic. |
| STE-10 | Use British English spelling (for example "colour", "centre", "behaviour"). Code identifiers and external API names keep their original spelling. |

The project does not have the licensed ASD-STE100 dictionary. Reviewers therefore check the rules above and the glossary, but they do not check each word against the STE approved-word list. Technical names (for example "H.264", "aspect ratio", "JPEG") are permitted.

### Glossary

The glossary is in [GLOSSARY.md](GLOSSARY.md). For each term, it gives the meaning and the synonyms that you must not use.

## 2. Website acceptance criteria

The project shall conform to the 60 criteria in this section. They come from "Website acceptance criteria, version 1.0" (4 November 2026). The project changed IA-01, CT-01, DC-01 and DC-03. These rows show "(project text)". Each row also gives the verification method for the audit.

Audit rules:

- Record each criterion as Pass, Fail or Not applicable, with evidence: a page address, a screenshot, a test result or a design decision. Give a reason for each Not applicable result.
- A visual convention can pass when it has a recorded purpose and its implementation supports that purpose. A recorded purpose does not override evidence that the convention prevents use.
- A Pass shows conformance to these criteria. It does not show who made the website or how.

[docs/design-spec.md](docs/design-spec.md) contains the design decisions that some criteria require as evidence. Examples are the type hierarchy (VS-02), colour roles (VS-04), component roles (DC-06), the motion inventory (IN-04) and the page-to-task map (IA-02).

### Purpose and information architecture

| ID | Requirement | Verification |
|---|---|---|
| IA-01 | (project text) Each page shall give sufficient orientation for its entry points. A page does not need an introductory paragraph, a subtitle or a product description when the context already makes the subject clear. | For each entry point, examine the first viewport. |
| IA-02 | Each page shall support an identified user task or information need. | Map each page to a task or need. |
| IA-03 | Each section shall give information or functions that the page does not already give elsewhere. | Find and remove redundant sections. |
| IA-04 | The section order shall follow the information that the user needs to understand or complete the principal task. | Compare the reading order with a recorded task sequence. |
| IA-05 | Navigation labels shall describe their destinations with consistent terms that the audience knows. | Compare the labels with the headings and content of the destinations. |
| IA-06 | Pricing, contact, availability, eligibility and other information for a decision shall be available where it applies to the offer. | Complete representative evaluation and purchase tasks. |

### Layout and composition

| ID | Requirement | Verification |
|---|---|---|
| LY-01 | The layout shall hold the actual content. Do not invent, duplicate or shorten content only to fill a template. | Compare the layout with the content inventory. |
| LY-02 | A card grid shall contain separate items that the user scans, compares or selects. | State the relation between the items in each grid. |
| LY-03 | Grid areas of different sizes shall show differences in importance, content or interaction. | Make sure that each larger area has a related purpose. |
| LY-04 | Visual prominence shall agree with task importance, not with decorative convenience. | Compare heading size, position and emphasis with the task priorities. |
| LY-05 | Section spacing shall separate related content from different topics without unnecessary scrolling. | Examine the full page at desktop and mobile widths. |
| LY-06 | Numbered items shall show an actual sequence, a ranking or a numbered reference system. | Make sure that the numbers give information. |

### Typography and colour

| ID | Requirement | Verification |
|---|---|---|
| VS-01 | The typeface shall support legibility, the audience and the approved visual identity. | Record the reason for the selection. Examine representative content. |
| VS-02 | Typography shall have a defined hierarchy for page titles, section headings, body text, labels and supporting text. | Compare the rendered pages with the type specification. |
| VS-03 | A change of typeface, colour, weight or style in a heading shall show a defined difference. | Explain each change. Remove arbitrary emphasis. |
| VS-04 | Each colour shall have the same role on all pages. | Examine accents, links, actions, warnings and status indicators. |
| VS-05 | Text and controls shall be legible on each background where they occur, including gradients and images. | Measure the contrast on each background and in each state. |
| VS-06 | Do not apply uppercase text and increased letter spacing to all section labels by default. | Examine the headings and labels for unnecessary repetition. |

### Decoration and component styling

| ID | Requirement | Verification |
|---|---|---|
| DC-01 | (project text) Gradients, glows, textures and background effects shall have an approved purpose. Visual identity, atmosphere and a coherent appearance are approved purposes. Each decorative detail does not need a separate functional reason. A decorative treatment shall not obscure content or imply an action that is not available. | Examine each effect against [docs/design-spec.md](docs/design-spec.md). |
| DC-02 | Transparency and background blur shall not make content and controls less legible or less easy to identify. | Test each panel over each background that it can cover. |
| DC-03 | (project text) Borders, accent strips and dividers shall show grouping, hierarchy, state or the visual identity. The DC-01 text about approved purposes also applies. | Identify the role of each recurring treatment. |
| DC-04 | A badge above a heading shall give specific information, for example status, category or availability. | Remove badges that only repeat a general promotional claim. |
| DC-05 | Icons shall make the meaning clearer or help recognition. Do not add icons only to fill empty components. | Examine each icon with and without its text. |
| DC-06 | Corner radii, shadows and surface treatments shall follow defined component roles. Do not apply one treatment to all components. | Compare cards, buttons, inputs, dialogs and decorative containers. |

### Written content

| ID | Requirement | Verification |
|---|---|---|
| CT-01 | (project text) Descriptive content shall be specific where it is necessary. Do not explain a function only because the function exists. | Find statements that you can move unchanged to an unrelated product. "Send invoices and track overdue payments" names functions that you can verify. "Unlock seamless financial empowerment" does not. |
| CT-02 | Each promotional claim shall have an explanation, a demonstration or evidence that is suitable for the claim. | Keep a claim-to-evidence record. |
| CT-03 | Each paragraph shall add information. It shall not repeat an earlier claim in different words. | Examine each paragraph for redundancy. |
| CT-04 | Each action label shall describe the action or the destination that follows. | Compare each label with its actual result. |
| CT-05 | Terms, spelling, units, currencies and date formats shall be consistent in the intended locale. | Do an editorial and locale review. |
| CT-06 | Published content shall not contain drafting instructions, placeholders, generation comments or unexplained example data. | Search the rendered pages and the repository. |

### Images and trust evidence

These criteria do not require photographs, testimonials or customer statistics when the website has no valid reason to show them.

| ID | Requirement | Verification |
|---|---|---|
| IM-01 | Informational images shall show the related product, service, process, location or subject accurately. | Compare each image with its caption and the claims near it. |
| IM-02 | Images that show evidence shall not show generated, stock or illustrative material as an actual person, customer, building or project. | Examine the source and the presentation of each image. |
| IM-03 | Product screenshots shall agree with the available product version, or shall be identified as previews or illustrations. | Compare the screenshots with the product. |
| IM-04 | Photographs and illustrations shall not contain unintended anatomical, geometric, text or physical errors. | Examine each image at its displayed size and at a larger size. |
| IM-05 | Testimonials, customer logos, awards and accreditation marks shall have a verified source and permission for publication. | Examine the records and permissions. |
| IM-06 | Statistics and performance claims shall give their basis, scope and date where this prevents an incorrect interpretation. | Examine the source records and the qualifying text. |

### Motion and interaction

| ID | Requirement | Verification |
|---|---|---|
| IN-01 | Each enabled control shall do the action that its label and appearance show. | Use each control. Examine the result or the destination. |
| IN-02 | Elements that are not interactive shall not have pointer cursors, hover movement or other treatments that imply an action. | Examine static cards, labels, illustrations and containers. |
| IN-03 | Essential content shall not stay hidden until a decorative entrance animation is complete. | Test the first load, fast scrolling and interrupted animations. |
| IN-04 | Each animation that the user does not start shall have a defined purpose. Do not apply animation to all sections or components. | Keep and examine a motion inventory. |
| IN-05 | Counters, typing effects and transitions shall not delay access to information or show an incorrect value or state. | Examine the page during and after each effect. |
| IN-06 | Navigation shall keep the usual browser behaviour, unless a recorded application requirement gives an equivalent alternative. | Test Back, Forward, direct links, refresh and links opened in a new tab. |

### Functional completeness

| ID | Requirement | Verification |
|---|---|---|
| FN-01 | Each principal workflow shall complete against the production service or a clearly identified demonstration environment. | Run end-to-end tests. A visual confirmation alone is not sufficient. |
| FN-02 | A success message shall show only after the related operation is successful. | Make requests fail and examine the actual result. |
| FN-03 | Forms shall identify incorrect input and give sufficient information to correct it. | Submit missing, incorrect and out-of-range values. |
| FN-04 | Each workflow shall have the applicable loading, empty, error, success, unavailable and permission-restricted states. | Test a state matrix for each workflow. |
| FN-05 | Search, filters, sorting and pagination shall operate on the related data and give consistent results. | Test known records, combined conditions and searches without results. |
| FN-06 | Saved information shall stay for the period and scope that the interface tells the user. | Test reloads, navigation, new sessions and, where applicable, a different device. |

### Responsive and accessible behaviour

| ID | Requirement | Verification |
|---|---|---|
| QA-01 | Content and controls shall be available and usable at each supported viewport width. | Test narrow, intermediate and wide widths, including widths between breakpoints. |
| QA-02 | Long text, missing images, large data sets and translated content shall not cause unintended overlap, clipping or missing controls. | Test representative content extremes and missing files. |
| QA-03 | Keyboard users shall be able to reach and use each interactive element, with a visible focus indicator. | Complete the principal tasks with the keyboard only. |
| QA-04 | Information and actions shall not be available only through pointer hover. | Test with keyboard, touch and pointer input. |
| QA-05 | Motion that is not essential shall stop when the user sets the reduced-motion preference. | Test with reduced motion set. |
| QA-06 | Fixed headers, floating controls, banners and overlays shall not cover necessary content or prevent the completion of a task. | Test scrolling, keyboard focus, zoom and small viewports. |

### Consistency and publication

| ID | Requirement | Verification |
|---|---|---|
| PB-01 | Shared components shall have the same appearance, terms and behaviour on all pages. | Compare each instance of each shared component. |
| PB-02 | Organisation names, product names, contact details, prices and policy statements shall agree on all pages. | Compare the published content. |
| PB-03 | Each published address and navigation link shall go to the intended content. No link shall go to an unresolved template destination. | Examine each address and the relevance of each destination. |
| PB-04 | Page titles, descriptions, browser icons and social-sharing images shall identify this website, not a starter project or a template. | Examine the page metadata and the sharing previews. |
| PB-05 | Error pages and secondary pages shall meet the same content and interaction requirements as the principal page. | Audit representative secondary pages and error pages. |
| PB-06 | Release approval shall include an inspection of the rendered website and the completion of representative tasks. A source-code review or screenshots alone are not sufficient. | Keep a release test record with visual and functional checks. |

### Strict visual profile: not adopted

The source document also has an optional strict visual profile (SX-01 to SX-08). It excludes familiar visual conventions, for example centred hero sections and icon cards. The project does not use it. Do not give it to a person or an AI assistant as design instructions. Assess familiar colours, typefaces, cards and layouts in context. They are not defects only because they are familiar.

## 3. Additional content requirements

| ID | Requirement |
|---|---|
| CP-01 | Supporting text shall resolve a relevant uncertainty, explain a consequence or prevent a probable error. Text that repeats a heading, a control or the immediate context is permitted only when it makes the task or its accessibility better. |
| CP-07 | An uncertainty is relevant only when the interface, the task or a known platform behaviour gives the user a reason for it. Assume that the application works as the user expects a similar application to work. Do not explain usual behaviour, and do not reassure the user about a problem that nothing on the page suggests. |
| CP-02 | Each factual statement shall use direct wording unless figurative wording improves understanding. |
| CP-03 | Routine confirmations shall state the completed action before providing optional commentary or subsequent actions. |
| CP-04 | Privacy assurances shall describe the actual scope of protection and shall not use unsupported absolute claims. |
| CP-05 | Copy shall not repeat a reassurance solely to maintain a conversational tone. |
| CP-06 | Rhetorical devices, including sentence fragments, three-part sequences and metaphors, shall not be added solely to give otherwise complete interface text personality. |

## 4. Editorial and design requirements

The criteria in sections 2 and 3 are quality checks. They tell you what to avoid. They do not tell you what a finished page must do. Use the design brief in section 4.1 first. Then use the criteria to check the result.

### 4.1 Design brief

Design each page for its actual user task. The criteria do not tell you to remove visual identity, to explain each function or to make the number of elements as small as possible.

Before you design a page, identify:

- The principal task of the page.
- Who opens the page, from where, and what they probably know already.
- The information that users must have before they do the task.
- The information that can be supporting detail.

Content:

- Include an explanation only when it resolves a relevant uncertainty, explains a consequence or prevents a probable error.
- Before you add an explanation, identify what on the page, in the task or in the platform gives the user a reason to ask the question. If nothing does, do not add the explanation (CP-07).
- Assume that the application works as the user expects. Explain only the behaviour that is different from what the user expects.
- Do not add a subtitle, an introduction, a reassurance, a slogan or a closing question by default.
- Do not describe an action that the controls already make clear.
- Use natural, direct wording. Do not use a promotional voice or a technical documentation voice by default.
- Keep necessary disclosures and qualifications. When you make text shorter, do not change its meaning or make a claim stronger.
- Do not invent user concerns or product facts to justify more text.

Design:

- Make a finished, coherent interface. An interface without styling is not a finished design.
- Show the hierarchy with typography, spacing, alignment, colour and proportion.
- Use familiar components and restrained decoration where they are suitable.
- Do not add content or decorative components only to fill empty space.

Keep the existing functions and the security behaviour. If you are not sure about authentication, privacy or session behaviour, record the question. Do not invent the details.

Before you change a page, list the proposed content in three groups: keep visible, move to supporting detail, remove. Record the list in [docs/design-spec.md](docs/design-spec.md). After the change, examine the rendered page against its principal task, not only against each criterion.

### 4.2 Requirements

| ID | Requirement |
|---|---|
| ED-01 | Before implementation, the principal task, the intended audience and the expected entry context of the page shall be identified. |
| ED-02 | Each explanation shall answer a specific question about the current action or decision of the user. The user shall have a reason to ask the question (CP-07). Factual accuracy alone shall not justify an explanation. |
| ED-03 | Each item of information shall be classified as necessary before the action, supporting detail or not necessary at this location. Necessary information shall be available before the related action. |
| ED-04 | Implementation details shall be given as consequences for the user, where those consequences are relevant. A technical explanation shall not replace clear interface behaviour. |
| ED-05 | The principal task and its action shall have more visual emphasis than optional supporting information. |
| ED-06 | Typography, spacing, alignment, colour and component styling shall make a coherent visual hierarchy. Removal of decoration alone shall not be a completed design. |
| ED-07 | Text that is made shorter shall keep material qualifications, privacy disclosures, accessibility information and the actual meaning of the system behaviour. |

## 5. Process

1. **During a change.** Apply sections 1 to 4. Update [docs/design-spec.md](docs/design-spec.md) when a type style, colour role, component role, animation or page changes.
2. **Automated checks.** The test suite shall include a standards test. This test checks colour contrast (VS-05) and the page metadata (PB-04). It also checks for placeholder text (CT-06), uppercase label treatment (VS-06), animation (IN-04, QA-05) and contractions in interface text (STE-05).
3. **Before a release.** Complete an audit record in [docs/audit/](docs/audit/). Copy the latest record and record each criterion as Pass, Fail or Not applicable, with evidence. Include a release test record: someone shall use the rendered application and complete the principal tasks (PB-06). A source-code review alone is not sufficient.
4. **Perception check.** After the audit, a person who did not make the change examines representative pages:
   1. Show the pages. Do not say how they were made.
   2. Ask the reviewer to identify the subject, the audience and the principal action.
   3. Ask which elements look general, irrelevant, unfinished or inconsistent.
   4. Ask if the website looks designed for its subject.
   5. Then ask if any features suggest automated or AI-assisted production. Ask for specific examples.
   6. Record each observation that you can act on as a failure against a criterion. Record subjective reactions separately.
5. **Release decision.** A release is acceptable when each applicable criterion has evidence and each failure is resolved or has a recorded, approved exclusion. Record the outstanding failures, the exclusions with their reasons, the approver and the date in the audit record.
