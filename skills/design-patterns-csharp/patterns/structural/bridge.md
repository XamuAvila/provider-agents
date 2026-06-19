# Bridge

**Categoria:** Padrões Estruturais
**Referência:** https://refactoring.guru/pt-br/design-patterns/bridge

## Propósito

O Bridge é um padrão de projeto estrutural que permite que você divida uma classe grande ou um conjunto de classes intimamente ligadas em duas hierarquias separadas—abstração e implementação—que podem ser desenvolvidas independentemente umas das outras.

## Problema

Abstração? Implementação? Soam um pouco assustadoras? Fique calmo que vamos considerar um exemplo simples.
Digamos que você tem uma classe Forma geométrica com um par de subclasses: Círculo e Quadrado. Você quer estender essa hierarquia de classe para incorporar cores, então você planeja criar as subclasses de forma Vermelho e Azul. Contudo, já que você já tem duas subclasses, você precisa criar quatro combinações de classe tais como CírculoAzul e QuadradoVermelho.
Adicionar novos tipos de forma

## Como Implementar

Identifique as dimensões ortogonais em suas classes. Esses conceitos independentes podem ser: abstração/plataforma, domínio/infraestrutura, front-end/back-end, ou interface/implementação.


Veja quais operações o cliente precisa e defina-as na classe abstração base.


Determine as operações disponíveis em todas as plataformas. Declare aquelas que a abstração precisa na interface geral de implementação.


Crie classes concretas de implementação para todas as plataformas de seu domínio, mas certifique-se que todas elas sigam a interface de implementação.


Dentro da classe de abstração, adicione um campo de referência para o tipo de implementação. A abstração delega a maior parte do trabalho para o objeto de implementação que foi referenciado neste campo.


Se você tem diversas variantes de 

## Relações com Outros Padrões

O Bridge é geralmente definido com antecedência, permitindo que você desenvolva partes de uma aplicação independentemente umas das outras. Por outro lado, o Adapter é comumente usado em aplicações existentes para fazer com que classes incompatíveis trabalhem bem juntas.


O Bridge, State, Strategy (e de certa forma o Adapter) têm estruturas muito parecidas. De fato, todos esses padrões estão baseados em composição, o que é delegar o trabalho para outros objetos. Contudo, eles todos resolvem prob

## Exemplo em C#

```csharp
using System;

namespace RefactoringGuru.DesignPatterns.Bridge.Conceptual
{
    // The Abstraction defines the interface for the "control" part of the two
    // class hierarchies. It maintains a reference to an object of the
    // Implementation hierarchy and delegates all of the real work to this
    // object.
    class Abstraction
    {
        protected IImplementation _implementation;
		
        public Abstraction(IImplementation implementation)
        {
            this._implementation = implementation;
        }
		
        public virtual string Operation()
        {
            return "Abstract: Base operation with:\n" + 
                _implementation.OperationImplementation();
        }
    }

    // You can extend the Abstraction without changing the Implementation
    // classes.
    class ExtendedAbstraction : Abstraction
    {
        public ExtendedAbstraction(IImplementation implementation) : base(implementation)
        {
		}
		
        public override string Operation()
        {
            return "ExtendedAbstraction: Extended operation with:\n" +
                base._implementation.OperationImplementation();
        }
    }

    // The Implementation defines the interface for all implementation classes.
    // It doesn't have to match the Abstraction's interface. In fact, the two
    // interfaces can be entirely different. Typically the Implementation
    // interface provides only primitive operations, while the Abstraction
    // defines higher- level operations based on those primitives.
    public interface IImplementation
    {
        string OperationImplementation();
    }

    // Each Concrete Implementation corresponds to a specific platform and
    // implements the Implementation interface using that platform's API.
    class ConcreteImplementationA : IImplementation
    {
        public string OperationImplementation()
        {
            return "ConcreteImplementationA: The result in platform A.\n";
        }
    }

    class ConcreteImplementationB : IImplementation
    {
        public string OperationImplementation()
        {
            return "ConcreteImplementationB: The result in platform B.\n";
        }
    }

    class Client
    {
        // Except for the initialization phase, where an Abstraction object gets
        // linked with a specific Implementation object, the client code should
        // only depend on the Abstraction class. This way the client code can
        // support any abstraction-implementation combination.
        public void ClientCode(Abstraction abstraction)
        {
            Console.Write(abstraction.Operation());
        }
    }
    
    class Program
    {
        static void Main(string[] args)
        {
            Client client = new Client();

            Abstraction abstraction;
            // The client code should be able to work with any pre-configured
            // abstraction-implementation combination.
            abstraction = new Abstraction(new ConcreteImplementationA());
            client.ClientCode(abstraction);
            
            Console.WriteLine();
            
            abstraction = new ExtendedAbstraction(new ConcreteImplementationB());
            client.ClientCode(abstraction);
        }
    }
}
```

### Output

```
Abstract: Base operation with:
ConcreteImplementationA: The result in platform A.

ExtendedAbstraction: Extended operation with:
ConcreteImplementationA: The result in platform B.
```
