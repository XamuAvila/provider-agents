# Decorator

**Categoria:** Padrões Estruturais
**Referência:** https://refactoring.guru/pt-br/design-patterns/decorator

## Propósito

O Decorator é um padrão de projeto estrutural que permite que você acople novos comportamentos para objetos ao colocá-los dentro de invólucros de objetos que contém os comportamentos.

## Problema

Imagine que você está trabalhando em um biblioteca de notificação que permite que outros programas notifiquem seus usuários sobre eventos importantes.
A versão inicial da biblioteca foi baseada na classe Notificador que tinha apenas alguns poucos campos, um construtor, e um único método enviar. O método podia aceitar um argumento de mensagem de um cliente e enviar a mensagem para uma lista de emails que eram passadas para o notificador através de seu construtor. Uma aplicação de terceiros que ag

## Como Implementar

Certifique-se que seu domínio de negócio pode ser representado como um componente primário com múltiplas camadas opcionais sobre ele.


Descubra quais métodos são comuns tanto para o componente primário e para as camadas opcionais. Crie uma interface componente e declare aqueles métodos ali.


Crie uma classe componente concreta e defina o comportamento base nela.


Crie uma classe decorador base. Ela deve ter um campo para armazenar uma referência ao objeto envolvido. O campo deve ser declarado com o tipo da interface componente para permitir uma ligação entre os componentes concretos e decoradores. O decorador base deve delegar todo o trabalho para o objeto envolvido.


Certifique-se que todas as classes implementam a interface componente.


Crie decoradores concretos estendendo-os a par

## Relações com Outros Padrões

O Adapter fornece uma interface completamente diferente para acessar um objeto existente. Por outro lado, com o padrão Decorator, a interface permanece a mesma ou é estendida. Além disso, o Decorator oferece suporte à composição recursiva, o que não é possível quando você usa o Adapter.


Com Adapter, você acessa um objeto existente por meio de uma interface diferente. Com Proxy, a interface permanece a mesma. Com Decorator, você acessa o objeto por meio de uma interface aprimorada.


O Chain of

## Exemplo em C#

```csharp
using System;

namespace RefactoringGuru.DesignPatterns.Composite.Conceptual
{
    // The base Component interface defines operations that can be altered by
    // decorators.
    public abstract class Component
    {
        public abstract string Operation();
    }

    // Concrete Components provide default implementations of the operations.
    // There might be several variations of these classes.
    class ConcreteComponent : Component
    {
        public override string Operation()
        {
            return "ConcreteComponent";
        }
    }

    // The base Decorator class follows the same interface as the other
    // components. The primary purpose of this class is to define the wrapping
    // interface for all concrete decorators. The default implementation of the
    // wrapping code might include a field for storing a wrapped component and
    // the means to initialize it.
    abstract class Decorator : Component
    {
        protected Component _component;

        public Decorator(Component component)
        {
            this._component = component;
        }

        public void SetComponent(Component component)
        {
            this._component = component;
        }

        // The Decorator delegates all work to the wrapped component.
        public override string Operation()
        {
            if (this._component != null)
            {
                return this._component.Operation();
            }
            else
            {
                return string.Empty;
            }
        }
    }

    // Concrete Decorators call the wrapped object and alter its result in some
    // way.
    class ConcreteDecoratorA : Decorator
    {
        public ConcreteDecoratorA(Component comp) : base(comp)
        {
        }

        // Decorators may call parent implementation of the operation, instead
        // of calling the wrapped object directly. This approach simplifies
        // extension of decorator classes.
        public override string Operation()
        {
            return $"ConcreteDecoratorA({base.Operation()})";
        }
    }

    // Decorators can execute their behavior either before or after the call to
    // a wrapped object.
    class ConcreteDecoratorB : Decorator
    {
        public ConcreteDecoratorB(Component comp) : base(comp)
        {
        }

        public override string Operation()
        {
            return $"ConcreteDecoratorB({base.Operation()})";
        }
    }
    
    public class Client
    {
        // The client code works with all objects using the Component interface.
        // This way it can stay independent of the concrete classes of
        // components it works with.
        public void ClientCode(Component component)
        {
            Console.WriteLine("RESULT: " + component.Operation());
        }
    }
    
    class Program
    {
        static void Main(string[] args)
        {
            Client client = new Client();

            var simple = new ConcreteComponent();
            Console.WriteLine("Client: I get a simple component:");
            client.ClientCode(simple);
            Console.WriteLine();

            // ...as well as decorated ones.
            //
            // Note how decorators can wrap not only simple components but the
            // other decorators as well.
            ConcreteDecoratorA decorator1 = new ConcreteDecoratorA(simple);
            ConcreteDecoratorB decorator2 = new ConcreteDecoratorB(decorator1);
            Console.WriteLine("Client: Now I've got a decorated component:");
            client.ClientCode(decorator2);
        }
    }
}
```

### Output

```
Client: I get a simple component:
RESULT: ConcreteComponent

Client: Now I've got a decorated component:
RESULT: ConcreteDecoratorB(ConcreteDecoratorA(ConcreteComponent))
```
