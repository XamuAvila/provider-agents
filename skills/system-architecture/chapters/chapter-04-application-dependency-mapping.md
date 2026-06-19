# Chapter 4: Application Dependency Mapping

**Fonte:** https://www.multiplayer.app/system-architecture/application-dependency-mapping/

## Application Dependency Mapping: Tutorial & Best Practices

The 2010s saw a transition away from the practice of hosting all components of a system architecture in-house. As open-source tools and cloud infrastructure platforms grew in popularity, system architectures began to rely more heavily on providers that offer smaller, more focused solutions for various system requirements.

Today, applications are often built using numerous providers, such as cloud services, APIs, logging and analytics platforms, and third-party SaaS integrations. As a result, many companies need to track a large number of dependencies across applications and services.

Application dependency mapping (ADM) is the process by which developers map out the components of their system architecture and the relationships among them. This article provides an overview of the ADM process, explores key ADM concepts, and outlines best practices for effective ADM implementation.

### Summary of key application dependency mapping concepts

The table below summarizes the ADM concepts we will explore in this article.

Concept | Description
--- | ---
Overview of the ADM process | ADM entails several key steps, including system discovery, mapping, documentation, monitoring, and ongoing maintenance.
Application dependency mapping example | Modern systems include a variety of software components, such as public web and mobile clients, private internal core APIs, analytics servers for logs and metrics analysis, message brokers, and third-party SaaS integrations. In this context, application dependency mapping serves as a reference in discussions with both technical and non-technical personnel.
Application dependency mapping best practices | Best practices for creating effective ADMs include determining requirements, documenting external dependencies, detailing different deployment environments, and implementing continuous monitoring.

### Overview of the application dependency mapping (ADM) process

ADM produces a topological map of components, channels, apps, ports, and services. Using specialized ADM tools, teams can maintain diagrams of their system architectures that stay updated as the systems evolve.

Within ADM, the term “dependencies” refers to more than just code libraries. An application may also rely on external tools such as managed service providers, application performance monitoring tools (e.g., NewRelic and DataDog), and logging systems. These external tools should also be included in a completed application dependency map because their inclusion makes it easier to conduct security audits and provide compliance guarantees.

The ADM process involves several steps beyond simply listing the code packages included in application bundles. These steps are summarized in the table below.

Process step | Goal
--- | ---
System discovery | Identify all components and dependencies in the system architecture
Mapping | Create visual representations of the system and relationships between dependencies
Documentation | Record detailed information about each component and dependency
Monitoring | Implement continuous monitoring of dependencies and system health
Maintenance | Regularly update the ADM as the system evolves

### System discovery techniques

The ADM process begins with system discovery, which involves identifying all components and dependencies in the system architecture. Teams can identify each element of their systems using a combination of the following techniques.

#### Manual mapping

Manual mapping is a common starting point in the ADM process. Manually examine your services and their configurations. Record this information and any other key details in a document or diagram. Manual mapping can be useful in a variety of scenarios, such as:

- Conducting an architectural brainstorming session with the entire team
- Modernizing or migrating systems from on-premises to cloud hosting
- Building a greenfield project
- Learning new system design patterns or architecture styles

This provides immediate benefits:

- Developers can immediately request feedback, internally or externally.
- Manual mapping facilitates knowledge sharing and collaboration among team members. Other team members can quickly gain a comprehensive understanding of the system from the ground up.
- Developers can ensure that no components are missed in internal reviews and/or future audits.

#### Automated mapping

While manual mapping is a useful starting point, it has limitations. Every system change requires manual updates to diagrams, which introduces overhead and increases the risk that dependencies or component relationships are missed.

Adding automation to the dependency mapping process mitigates these issues by using software tools to automatically identify, visualize, and track dependencies between components of a software system. For example, tools like Multiplayer provide a suite of features that maintain continuously updated views of components and their relationships, capture frontend user interactions correlated with backend and API data, and help teams quickly document and test integrations with enriched text alongside executable API calls and code snippets.

#### Using server agents

Server agents are specialized software components deployed on servers to collect granular data about the system’s environment. They gather extensive information about installed software, running services, and configurations, providing a detailed inventory of server assets. Server agents run autonomously and can be left running for long periods after they are deployed. By analyzing the data collected by server agents, teams can identify which resources are connected to their system’s network and gain insights into performance metrics such as network usage, CPU performance, file system usage, and RAM utilization.

#### Analyzing orchestration platform configurations

Orchestration platforms leverage configurations from tools like Kubernetes and Docker Compose to identify and manage system components and their interdependencies. These platforms define how containers and services are orchestrated within a system and provide a path for understanding the operational blueprint of the infrastructure.

Teams can analyze orchestration platform configurations, which enables them to map out service dependencies, scaling rules, and deployment strategies.

#### Network monitoring

Continuously listening for network traffic helps pinpoint system components and map out their communications, providing real-time insights into system health and efficiency. Network monitoring also helps detect unauthorized devices or services, ensure security compliance, and optimize network performance. Finally, network monitoring aids in capacity planning and troubleshooting by providing detailed logs that can be analyzed to identify bottlenecks or failure points in the system.

Read this article to learn more about system discovery techniques.

### The role of architecture diagrams

The goal of ADM is to create diagrams that visualize the full structure of a system and communicate its architecture to different stakeholders. This involves drawing detailed maps of system components that showcase their relationships and interactions.

When creating diagrams, keep the following ideas in mind:

- Diagrams should represent the system’s layers, nodes, and connections in a clear, accessible manner.
- Diagrams should make abstract ideas tangible and improve communication among different stakeholders to streamline application development and the system design process.
- Diagrams should highlight system inefficiencies and potential points of failure so that developers can proactively address these issues.

Finally, it is important to note that diagrams are only effective when they are kept up to date. Outdated diagrams can become stale, unused artifacts or may miscommunicate important information about the current state of the system. This hinders development efforts.

### Application dependency mapping example

Let’s take a look at how we might map a real-world system. Take the example of a system architecture deployed to AWS with these components:

- Public web and mobile clients
- A private internal core API
- A private, in-house analytics server for logs and metrics analysis
- Caching with Redis
- Kafka for communications between system components
- Snowflake for data management

In addition, all services are hidden behind proxies and gateways, which present an interface for clients to access the network without having access to internal services.

A high-level dependency map for such a system might look something like this:

An example ADM for a distributed system architecture

### Interact with full-stack session recordings to appreciate how they can help with debugging

This visual can serve as a reference in discussions with both technical and non-technical personnel. Stakeholders or product owners may find themselves turning to the ADM to find answers to questions like: “What potential for data loss do we have in our analytics service?” In this example, the core service pushes data to Kafka and Amazon S3, both of which have service-level availability guarantees that could result in data loss. This might factor into decision-making for product, development, or other departments.

### Application dependency mapping best practices

Now that we have discussed the ADM process and explored an example ADM, let’s take a look at seven best practices for effective application dependency mapping. Here is a summary of these practices, with details to follow.

Best practice | Description
--- | ---
Start by determining the requirements | A list of detailed requirements informs what information to focus on in application dependency maps.
Document all external dependencies | Establish detailed descriptions of each dependency and its ecosystem.
Segment data environments | Document all environments. Detail any configurations, secrets, or processes that are unique to each environment.
Monitor all dependencies and containers | Monitoring dependencies in CI environments enables quick responses to new issues. Check for vulnerabilities, new patches, and updates.
Document critical tasks, requirements, and decisions | Documenting decisions helps stakeholders and non-technical staff gain an understanding of how a system architecture is evolving. Use these documents to inform engineering planning and speed up onboarding for newer team members.
Keep a human in the loop | Always have a reviewer check the state of dependencies before updating their versions or installing patches.

#### Start by determining requirements

There are two areas where pre-planning is needed: technical and non-technical requirements.

For technical planning, an ADM can provide alignment between business objectives and technical strategic planning. All relevant service-level agreements (SLAs) and service-level objectives (SLOs) should be documented and included in an ADM. These provide readers with an understanding of business requirements and target system metrics. In the absence of official SLAs, start by determining consistency and availability requirements. Relevant key performance indicators (KPIs) may also be included for each dependency. At this stage, the team also identifies key practical issues or bottlenecks that need to be mitigated, such as critical components ​​that could severely impact system operations if they fail.

In addition to technical requirements, the practical implications of system components should be considered. For example, it is prudent to list all security, compliance, and legal requirements. Any architectural decisions made in response to these issues should be documented, and the relevant system components should be included in the ADM. User roles and system access levels should also be clarified. When applicable, an ADM is also a place to indicate where non-technical personnel can access important data or trigger business processes in the system.

#### Document all external dependencies

ADMs are not only for documenting internal code packages—external services, libraries, and networks should also be documented. Include all providers, integrations, and configuration details. For complex dependencies, list details such as the provider’s SLAs, required environment variables, and scaling limits.

Let’s look at an example of a complex dependency: Upstash Redis. Upstash provides a hosted Redis service that applications connect to over a network to execute requests. If adding this to our external dependencies, we might document it as follows:

Category | Information
--- | ---
Provider | Upstash
Service | Redis
Regional database availability | USA and Europe
Deployment Environment | AWS Lambda
Monitoring | DataDog
Environment Variables | UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
Rate Limits | Allows 10 requests per 10 seconds
SLA | Monthly uptime percentage >= 99.99%

Documenting services in this way allows ADMs to serve as a centralized source of system information. In addition to showing a high-level overview of the system, the ADM serves as a centralized document with details on different components’ functional and non-functional characteristics.

#### Include details on different environments

Modern development teams often utilize multiple environments, such as development, staging, and production. Each environment may have its own unique configurations, secrets, and processes. When creating an ADM, it is crucial to document these differences to ensure that all team members have a clear understanding of the specific requirements for each environment.

Start by identifying all the environments in your system architecture. For each environment, provide detailed information about its purpose, access control, and any specific configurations or settings. This may include:

- Environment-specific variables: Document any environment variables that are unique to each environment, such as database connection strings, API keys, or service endpoints.
- Secret management: Clearly outline how secrets, such as passwords, tokens, and certificates, are managed and accessed in each environment. This may involve using tools like Hashicorp Vault, AWS Secrets Manager, or Kubernetes Secrets.
- Deployment processes: Describe the deployment processes for each environment, including any automated CI/CD pipelines, manual approval steps, or rollback procedures.
- Access control: Specify who has access to each environment and what level of access they have. This may include details about role-based access control (RBAC), VPN requirements, or IP whitelisting.
- Data segregation: If your system handles sensitive data, document how data is segregated between environments to ensure compliance with privacy regulations and prevent unauthorized access.

Document any differences between environments, and illuminate any unique aspects of the configuration for each. Track secrets and environment variables that are needed for each environment. Thorough environment documentation can help prevent misconfigurations, reduce the risk of security breaches, and ensure that all team members have the information they need to work effectively.

#### Monitor all dependencies and containers

Much like operating systems, open-source packages can—and frequently do—contain security vulnerabilities. Even NPM, the largest registry of code dependencies, has had its share of vulnerabilities. At the developer level, it is a best practice to add tools to the individual development process that assist in monitoring dependency health.

Pay attention to both open- and closed-source dependencies. Companies with security guarantees (such as service agreements or legal compliances) should investigate each dependency’s update frequency, versioning, and ongoing sustainability. Consider factors like vendor lock-in, customer support, and the ecosystem around the dependency.

Document any known limitations, such as rate limits or resource consumption limits. Ensure that dependencies with security issues, a lack of maintenance, or frequently broken builds are not included in production systems. This can be done using tools such as Trivy. Trivy scans Kubernetes, AWS, filesystems, virtual machines, and Git repos for common vulnerabilities and exposures (CVEs), licensing issues, exposed credentials, and protected health information (PHI). When any of these are found, teams will be notified immediately so that they can take appropriate action.

A well-documented ADM enables teams to quickly adjust, disable, or update dependencies with greater confidence that unexpected issues will not be introduced as a result.

#### Document critical tasks, requirements, and decisions

Include stakeholders and product owners in system design decisions where relevant. In addition to ADMs, documents such as architectural decision records (ADRs), and system architecture diagrams empower individual contributors to illustrate the key points in the system architectures to non-technical personnel.

Formulate a plan for preventative maintenance to protect application integrity, planning around potential points of failure in the system. These plans should be included in the final ADM for a system.

For example, suppose a team is planning a high-traffic application that sends email notifications to users based on in-application activities; the application serves 1 million daily active users and has periods of high activity each day. This application is likely to encounter a number of system health risks at capacity: risk of application slowdown during peak traffic periods, risk of data loss, or resource constraint issues. External dependencies introduce their own set of considerations such as rate limits, geographical availability, and failure handling.

As engineering teams plan various initiatives, discussions with stakeholders and product owners will arise. Non-technical considerations play an equally large factor in such an architecture—compliance requirements, legal considerations, and business domain details will form a critical component of the system’s architectural design.

An ADM presents a visual that non-technical personnel can use to browse the system architecture without specialized technical knowledge. Decision-making documents such as ADRs serve to inform personnel about the decisions and tradeoffs that have led to key architectural choices. As major changes are made in the system, updating documentation accordingly ensures alignment between departments.

Tools like Multiplayer can help centralize this information. Using notebooks, teams can combine text, code, and executable API calls to document system requirements, capture design logic, and maintain decision history in a single, accessible location.

#### Leverage AI tools to support dependency mapping

Modern AI tools can assist with application dependency mapping by surfacing relationships, generating architectural context, and helping developers navigate complex systems more efficiently. For example, developers can use AI assistants to answer questions about system structure, help trace dependencies across services, or highlight potential downstream effects of code changes.

The quality of AI suggestions depends on the data they can ingest. When only provided with static code and documentation, AI tools do not have access to the contextual information (user behavior, runtime interactions, performance data, etc.) that helps them understand how components work together in a live environment. However, when provided with structured, up-to-date dependency information via a tool like Multiplayer’s MCP server, the quality of AI suggestions improves, and developers can more easily maintain and document an accurate view of the application’s architecture.

#### Keep a human in the loop

Regardless of which tools are used, it is always a good practice to have team members review the system architecture as it evolves. Doing so helps developers better understand the underlying system architecture and how it relates to their individual work while spotting areas for improvement. In addition, human review is often a requirement for companies that must comply with security or legal requirements. This form of review can be incorporated into internal auditing and review processes.

Incorporate regular reviews of your system design into your development process, particularly when developing new features, ideating architecture decisions, or performing significant refactoring. Request peer reviews from other team members to prevent unnoticed issues from being introduced.

In addition, migrate dependencies only after thoroughly reviewing release notes and code changes. If possible, use lockfile enforcement to lock in dependency versions and prevent them from being auto-updated. Finally, utilize a pull request system or have team discussions before changing code dependencies.

### Last thoughts

Application dependency mapping is a crucial process for managing the complexity of modern system architectures. By following the best practices outlined in this article, teams can create and maintain accurate, up-to-date, and informative ADMs that provide numerous benefits, including:

- Improved system visibility and understanding for both technical and non-technical stakeholders
- Enhanced collaboration and communication between IT and non-IT personnel
- Faster detection and resolution of bugs, vulnerabilities, and compatibility issues
- Streamlined compliance management and security auditing
- More effective onboarding for new team members

Here are some key takeaways about the ADM process:

- Tie ADM into team processes and keep the two in sync.
- Use ADM to establish shared understanding between technical and non-technical team members.
- Document system changes and architectural decisions in your ADM to serve as a reference for future contributors.

Multiplayer empowers teams and contributors to maintain an accurate representation of their systems and leverage AI tools to assist in the ADM process. By leveraging this automated tooling and following the best practices discussed in this article, engineering teams can enhance collaboration, streamline compliance, and promote a shared understanding of complex system architectures across the entire organization.

### Last thoughts

Application dependency mapping is a crucial process for managing the complexity of modern system architectures. By following the best practices outlined in this article, teams can create and maintain accurate, up-to-date, and informative ADMs that provide numerous benefits, including:

- Improved system visibility and understanding for both technical and non-technical stakeholders
- Enhanced collaboration and communication between IT and non-IT personnel
- Faster detection and resolution of bugs, vulnerabilities, and compatibility issues
- Streamlined compliance management and security auditing
- More effective onboarding for new team members

Here are some key takeaways about the ADM process:

- Tie ADM into team processes and keep the two in sync.
- Use ADM to establish shared understanding between technical and non-technical team members.
- Document system changes and architectural decisions in your ADM to serve as a reference for future contributors.

Multiplayer empowers teams and contributors to maintain an accurate representation of their systems and leverage AI tools to assist in the ADM process. By leveraging this automated tooling and following the best practices discussed in this article, engineering teams can enhance collaboration, streamline compliance, and promote a shared understanding of complex system architectures across the entire organization.
