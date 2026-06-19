# Chapter 5: Multi Cloud Architecture

**Fonte:** https://www.multiplayer.app/system-architecture/multi-cloud-architecture/

## Multi Cloud Architecture: Tutorial & Best Practices

Multi-cloud architecture design strategically uses multiple cloud service providers to create a resilient, flexible, and cost-effective IT infrastructure. However, with the benefits of multi-cloud comes increased complexity for teams to manage. Organizations that get the most out of multi-cloud architectures effectively balance various tradeoffs to meet business requirements.

This article will provide an overview of the objectives, design components, planning steps, and best practices for getting the most from multi-cloud architectures. It will help engineering teams and architects understand how to leverage multiple cloud environments to meet organizational needs. Specific topics we will explore include enhancing redundancy, optimizing performance, managing costs, ensuring security, and maintaining compliance across different cloud platforms.

### Summary of key multi-cloud architecture concepts

The table below provides an overview of multi-cloud architecture concepts discussed in this article.

Concept | Description
--- | ---
Objectives of multi-cloud architecture | The objectives of multi-cloud architecture are to enhance redundancy, ensure high availability, optimize performance, manage costs, provide geo-located services, and avoid vendor lock-in by strategically leveraging services from multiple cloud providers.
Design components and considerations | Important considerations when designing a multi-cloud architecture include selecting cloud providers, establishing inter-cloud connectivity, deploying compute and storage resources, ensuring security and compliance, and optimizing cost management.
Eight essential multi-cloud architecture best practices | Best practices for multi-cloud architecture design include planning for success, maintaining comprehensive documentation, applying consistent security measures, automating infrastructure management, and optimizing performance.

### Objectives of multi-cloud architecture

The primary objective of multi-cloud architecture is to implement redundancy and maintain high availability. By distributing workloads and resources across multiple cloud providers, engineers can mitigate the risk of service outages and failures associated with relying on a single provider. Multi-cloud distribution ensures that if one cloud provider experiences a disruption, applications and services can continue operating seamlessly using other providers' resources.

This redundancy is crucial for maintaining business continuity and delivering a consistent user experience. In addition, leveraging multiple cloud providers allows for geographic diversity, ensuring that data and services are closer to end users. This reduces latency and improves performance while maintaining regulatory compliance with geo-specific privacy regulations such as GDPR.

Overview of a local (on-premises) data center leveraging multiple cloud providers (adapted from source)

This approach both enhances application performance and allows for cost optimization. Engineers can utilize the most performant and cost-effective storage solutions, compute instances, and specialized services from different providers to balance performance and expenses. Moreover, a multi-cloud strategy helps organizations avoid vendor lock-in, providing the flexibility to switch providers or integrate new services as needed. This ensures that the architecture remains adaptable to evolving business requirements and technological advancements.

### Design elements and considerations

Designing a multi-cloud architecture requires consideration of various elements to ensure a robust, secure, and efficient infrastructure.

Here is a chart comparing various cloud providers based on their features:

Feature | AWS | Azure | Google Cloud | Specialized Providers
--- | --- | --- | --- | ---
Global Reach | Extensive | Extensive | Moderate | Limited to Regional
Compute Options | EC2, Lambda, Containers | VMs, Functions, Containers | Compute Engine, Cloud Functions, Kubernetes Engine | Custom VMs, Bare Metal
Storage Solutions | S3, Elastic Block Store, Glacier | Blob Storage, Managed Disks | Cloud Storage, Persistent Disks | High-performance storage, Object Storage
AI/ML Services | SageMaker, Rekognition | Azure ML, Cognitive Services | AI Platform, Vision AI | Varies by Provider
Pricing Models | Pay-as-you-go, Reserved Instances | Pay-as-you-go, Reserved Instances | Pay-as-you-go, Sustained Use Discounts | Custom Pricing, Subscription
Compliance Certifications | GDPR, HIPAA, PCI-DSS | GDPR, HIPAA, PCI-DSS | GDPR, HIPAA, PCI-DSS | Varies by Provider
Security Features | IAM, KMS, VPC | Azure AD, Key Vault, Azure NSGs | Cloud IAM, Cloud KMS, VPC Service Controls | Custom Security Implementations
Interoperability | API Gateway, S3 Transfer Acceleration | Azure Arc, Data Lake | Anthos, BigQuery Data Transfer | Depends on Provider
Developer Tools | AWS CodeBuild, CodeDeploy | Azure DevOps, GitHub Actions | Cloud Build, Cloud Source Repositories | Varies by Provider

This comparison highlights features across primary and specialized cloud providers, helping you understand their strengths and suitability for different use cases. ​

#### Connecting cloud services

Once appropriate services are identified, developers must establish secure and efficient connections between the services. This includes utilizing VPNs, dedicated interconnects, or SD-WAN solutions to ensure low latency and reliable communication between providers.

Example multi-cloud architecture (adapted from source)

The figure above depicts a multi-cloud architecture that leverages specific features from different providers based on the business's needs.

- Software-Defined Wide Area Network (SD-WAN): Manages wide area network (WAN) connections, allowing organizations to efficiently use multiple types of connections, such as broadband, 4G/5G, LTE, etc.
- Global backbones: Offer direct connections to major cloud providers through providers like Equinix, Alkira, or Megaport. This allows organizations to securely connect to multiple clouds with reduced latency compared to public internet connections, improving performance and reliability.
- Cloud-specific direct connects: Allow services to bypass the public internet through services like AWS Direct Connect, Azure ExpressRoute, Google Cloud Interconnect, and Oracle FastConnect. This reduces network congestion and latency and leads to faster and more reliable data transfers between on-premises systems and cloud services.
- AWS object storage S3: Provides 99.999999999 (eleven nines) durability and high availability by replicating data across multiple sites within the provisioned region.
- AWS compute instances: The AWS elastic compute platform (EC2) provides a platform that scales up and down dynamically. AWS offers different instance types, from basic to high-performance GPU.
- Azure DevOps platform: Provides developers with an excellent environment for source control, CI/CD pipelines, Agile project tracking, and bug tracking.
- Azure Kubernetes: Provides a compute solution for containerized workloads with full orchestration.
- Google Cloud Tensor Processing Units (TPUs): Machine learning: Provides access to TPUs, custom-built processors optimized for machine learning tasks, improving performance for training large AI models.
- Oracle Cloud: Provides business applications and functionality across many business verticals such as HR, financials, and customer relationship management.

As shown above, a robust multi-cloud architecture relies on a variety of services from different vendors to facilitate communication, scalability of compute and storage solutions, data management, DevOps practices, and other application- and business-specific functions.

### Eight essential multi-cloud architecture best practices

Designing a multi-cloud architecture involves navigating a complex landscape of technologies and strategies to ensure reliability, performance, security, and cost-effectiveness. Here are some essential best practices to follow:

#### Plan for success

To design an effective multi-cloud architecture, teams should:

- Start by defining clear objectives that align with business goals such as redundancy, performance optimization, cost management, and compliance.
- Identify the technical requirements, including workload distribution, data replication, and security policies.
- Assess IT infrastructure to determine what can be integrated or migrated to a multi-cloud environment.
- Evaluate cloud providers to match your needs.

Creating an effective multi-cloud architecture requires input from various teams, including development, operations, security, and compliance. Each team brings a unique perspective. Developers focus on performance and scalability, while security teams prioritize data protection and compliance. Collaboration ensures that all aspects of the architecture are addressed comprehensively.

#### The role of documentation

To collaborate effectively, all stakeholders require a shared understanding of the system, the decisions that led to its current implementation, and its overarching business goals. To this end, it is crucial to create and maintain documentation that is clear, up-to-date, and easily accessible to everyone involved.

Start by ensuring that your system’s current state is well understood. Create artifacts (architecture diagrams, service catalogs, dependency maps, etc.) to document the components of your environment and how they interact. In addition, it is equally important to document the system’s design intent and why certain architectural decisions have been made to provide historical context, explain intentional trade-offs and known technical debt, and align on next steps.

Finally, documentation should be integrated into the development workflow so that it is updated alongside changes to the system itself. This can be a time-consuming process when developers must navigate multiple tools to update scattered artifacts. However, modern tools can significantly ease the process.

For example, Multiplayer notebooks are an effective documentation tool that can be authored manually or generated from natural language or real session data with AI assistance to alleviate the overhead of continuously updating documentation. They allow teams to combine API calls and code snippets with enriched text to present information like system requirements docs, rationale docs, and architectural decision records alongside live executions of system behavior. In addition, teams can leverage Multiplayer’s system dashboard to automatically create architecture diagrams and view a live summary of running components, APIs, dependencies, and environments.

#### Ensure security and compliance

Maintaining a strong security posture in a multi-cloud environment requires implementing unified security policies to ensure consistent protection across all cloud platforms. Encrypting data in transit and at rest is crucial for safeguarding sensitive information from unauthorized access and breaches. Services such as AWS S3 provide encryption for data at rest, while backbone and direct connect services like Equinix and AWS Direct Connect ensure encryption over the network.

In addition, continuous compliance monitoring is essential to comply with GDPR, HIPAA, and PCI-DSS regulations. It helps organizations avoid legal and financial penalties while maintaining customer and stakeholder trust in data privacy and security. Tools such as AWS Macie and Google Cloud Data Loss Prevention can help ensure your organization remains compliant.

#### Optimize performance

Efficient traffic distribution and latency reduction are essential for a robust multi-cloud architecture. Consider utilizing the following techniques:

- Global load balancing - Directs traffic across multiple servers and locations to prevent overload and provide low latency for users regardless of location. This enhances resource efficiency and system reliability.
- Edge computing - A system architecture style in which data is processed closer to its source to improve response times. This is particularly beneficial for real-time applications like IoT and online gaming platforms.
- Content delivery networks (CDNs) - enhance performance by caching frequently accessed content close to end users, reducing the number of database transactions and improving response times and system efficiency.

In addition to designing a system with performance considerations in mind upfront, it is essential to continuously validate performance across new releases. Different types of performance testing–such as load, stress, spike, or soak testing–play a critical role in this process. Records of test runs should be stored in a central location so that they can be analyzed and performance trends can be identified over time.

#### Utilize strong identity and access management (IAM)

A unified Identity and Access Management (IAM) system is crucial for managing user access across all cloud platforms, ensuring consistency and streamlined administration. Organizations can maintain a cohesive security strategy by centralizing IAM with a Single sign-on (SSO) solution like Okta or Oauth0, making managing permissions and monitoring access easier.

Following the principle of least privilege is essential; users should be granted the minimum level of access necessary to perform their roles. This reduces the risk of unauthorized access and potential security breaches. Finally, enforcing multi-factor authentication (MFA) for all critical access points significantly enhances security by ensuring the system remains secure even if one credential is compromised.

#### Manage and optimize costs

The first step in managing architecture costs is to understand the existing system and how different components contribute to the overall picture. To this end, utilizing effective tool to visualize your system architecture (components, APIs, dependencies, environments, etc.) is a crucial starting point.

Once a comprehensive picture of the system is established and documented, develop a strategy for right-sizing resources by regularly reviewing and adjusting resource allocations. Conduct performance testing and utilize application performance monitoring (APM) tools to ensure that cloud resources scale up and down efficiently in response to different traffic patterns. These practices help prevent over-provisioning and ensure active resources are not overutilized or underutilized to minimize costs while maintaining performance.

In addition, tools like AWS Cost Explorer, Azure Cost Management, and Google Cloud Billing should be used to monitor and analyze provider costs as the application evolves. Insights from these tools highlight areas for cost optimization and ensure that stakeholders are aware when expenditures grow beyond anticipated thresholds.

#### Employ automation and Infrastructure as Code (IaC)

Infrastructure as Code (IaC) tools such as Terraform, CloudFormation, and Ansible play a crucial role in modern IT operations by enabling consistent infrastructure management and automating provisioning processes. These tools allow teams to define infrastructure components programmatically, making replicating and scaling environments across multiple cloud platforms easier. By leveraging IaC, organizations can achieve faster deployment times, reduce human error, and maintain infrastructure configurations more efficiently.

#### Terraform EC2 Instance Example

```
# Specify the provider
provider "aws" {
  region = "us-west-2"  # Change to your desired region
}

# Create a new EC2 instance
resource "aws_instance" "example" {
  ami           = "ami-0c55b159cbfafe1f0"  # Amazon Linux 2 AMI ID (Change it based on your region)
  instance_type = "t2.micro"  # Free-tier eligible instance type

  # Key pair for SSH access (optional, replace with your key name)
  key_name = "my-key-pair"

  # Security Group to allow SSH access
  vpc_security_group_ids = [aws_security_group.instance_sg.id]

  # Tags for the instance
  tags = {
    Name = "My-Terraform-EC2"
  }
}

# Create a security group to allow SSH access
resource "aws_security_group" "instance_sg" {
  name        = "allow_ssh"
  description = "Allow SSH inbound traffic"

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]  # Allow all IPs (adjust for your use case)
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"  # Allow all outbound traffic
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# Output the public IP of the instance
output "instance_public_ip" {
  value = aws_instance.example.public_ip
}
```

Here is a definition of the values used:

- Provider Block: Defines the AWS provider and specifies the region (us-west-2 in this case).
- aws_instance Resource: Creates an EC2 instance using the specified AMI (Amazon Linux 2), with instance type t2.micro (free-tier eligible).
- aws_security_group Resource: Sets up a security group to allow SSH access (port 22).
- Key Pair: You can specify your key pair (my-key-pair) for SSH access to the instance.
- Output Block: Outputs the instance's public IP once it is created.
- Save the configuration into a file, for example, main.tf.

Initialize Terraform in your directory:

```
terraform init
```

Apply the configuration to create the EC2 instance:

```
terraform apply
```

Review the output and type yes to confirm.

This code will create an EC2 instance with SSH access allowed via the specified security group.

In addition to IaC, implementing continuous integration and continuous deployment (CI/CD) pipelines is essential for automating application and service deployment and updating processes. CI/CD pipelines facilitate the integration of code changes into a shared repository, followed by automated testing and deployment to production environments. This approach enhances development efficiency, accelerates time-to-market for new features, and improves overall software quality through consistent testing and deployment practices.

#### Implement observability across clouds

Multi-cloud environments are difficult to troubleshoot because components and services are split across different providers, and each provider may utilize different logging tools, formats, and monitoring services. Without a consistent strategy, teams end up chasing issues through a patchwork of disconnected systems, which slows down incident response and makes root-cause analysis difficult.

The first step toward effective troubleshooting is to standardize how telemetry is collected and aggregated. OpenTelemetry has become the industry standard for instrumenting distributed systems and capturing traces, metrics, and logs from services running in different environments. Data from OpenTelemetry is commonly exported to platforms like Grafana, Prometheus, the ELK stack, or a managed observability service to provide developers with a centralized view of system behavior.

However, the gap in this approach is that developers do not have access to what happened on the frontend. Even if they can view user interactions through a frontend session recorder, correlating these actions to backend data to gain end-to-end visibility means stitching together disparate pieces of information from separate tools.

A more practical way to see both what the user experienced and how the system responded is to supplement your observability approach with a tool that captures full stack session recordings, which include both frontend screens and correlated backend data (errors, distributed traces, request/response content and headers, etc.). Doing so can make it easier for developers to pinpoint root causes, understand the context of errors, and validate fixes. In addition, recorders like Multiplayer expose session data via an MCP server so that AI tools can use it to generate more accurate code for bug fixes, tests, new features, and architectural improvements.

Multiplayer full stack session recordings

### Last thoughts

Adopting a multi-cloud architecture enables development teams to harness the strengths of various cloud service providers and create a flexible and cost-effective IT infrastructure. This strategic approach ensures high availability and optimized performance while avoiding vendor lock-in and maintaining compliance with regulatory standards.

By focusing on organizational objectives, design considerations, planning steps, and best practices, teams can build robust multi-cloud environments that meet evolving business needs and technological advancements. Embracing this architecture creates resilient applications with the flexibility to adapt to future challenges and opportunities in the cloud landscape.

### Last thoughts

Adopting a multi-cloud architecture enables development teams to harness the strengths of various cloud service providers and create a flexible and cost-effective IT infrastructure. This strategic approach ensures high availability and optimized performance while avoiding vendor lock-in and maintaining compliance with regulatory standards.

By focusing on organizational objectives, design considerations, planning steps, and best practices, teams can build robust multi-cloud environments that meet evolving business needs and technological advancements. Embracing this architecture creates resilient applications with the flexibility to adapt to future challenges and opportunities in the cloud landscape.
