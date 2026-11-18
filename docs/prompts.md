read how you can optimize the prompt:
"""""
existing module = 🔐 Authentication module
future module = User Accounts

I am building a new PMS system with a {future module} to cover the user journeys identified in the {existing module}. 
To achieve that, I need the scope and requirements for the future system. 
Abstract from the current system. The result should be in the text format. 
Organize it within the docs folder, @docs. 
Take time, use tools, and plan before the execution. 
"""""

Context
- Existing module: 🔐 Authentication module
- Future module: User Accounts
- Product: new PMS system

Goal
Create the scope and requirements for the “User Accounts” module that fully covers the user journeys currently handled by the “Authentication” module, but without referencing or inheriting the current implementation.

Constraints
- Abstract from the current system: do NOT describe current screens, DB schema, APIs, vendors, or technical stack.
- Focus on user journeys, capabilities, business rules, and non-functional requirements.
- Output must be text (Markdown preferred).

Deliverable
Produce documentation organized under @docs with the following files:

@docs/user-accounts/README.md
- Purpose and module boundaries
- In-scope vs out-of-scope
- Assumptions and glossary

@docs/user-accounts/user-journeys.md
- List all user journeys (happy path + key variants)
- Actors/roles involved
- Preconditions, triggers, outcomes

@docs/user-accounts/functional-requirements.md
For each requirement:
- ID (UA-FR-###)
- Description (testable)
- Priority (Must/Should/Could)
- Rationale (1–2 lines)
- Acceptance criteria (Given/When/Then)

@docs/user-accounts/business-rules.md
- Policies, validation rules, lifecycle rules, edge cases

@docs/user-accounts/non-functional-requirements.md
- Security/privacy expectations, auditability, availability, performance, usability, accessibility, localization, data retention

@docs/user-accounts/data-and-permissions.md
- Core entities (conceptual only, no schema)
- Roles/permissions model (capabilities matrix)
- Audit events that must be recorded

Process
1) First, infer and enumerate the likely authentication-related journeys that must be supported (e.g., sign-in, password reset, MFA, session/device management, etc.) and list any assumptions you make.
2) Then write the docs as specified above.
3) Ensure no part of the output depends on the current system’s implementation details.

Quality bar (self-check before final output)
- Every journey maps to at least one functional requirement.
- Requirements are unambiguous and testable.
- Includes edge cases and failure states.
- Clear module boundaries and out-of-scope items.
