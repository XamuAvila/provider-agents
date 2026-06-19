# Mediator

**Categoria:** Padrões Comportamentais
**Referência:** https://refactoring.guru/pt-br/design-patterns/mediator

## Propósito

O Mediator é um padrão de projeto comportamental que permite que você reduza as dependências caóticas entre objetos. O padrão restringe comunicações diretas entre objetos e os força a colaborar apenas através do objeto mediador.

## Problema

Digamos que você tem uma caixa de diálogo para criar e editar perfis de clientes. Ela consiste em vários controles de formulário tais como campos de texto, caixas de seleção, botões, etc.
Alguns dos elementos do formulário podem interagir com outros. Por exemplo, selecionando a caixa de “Eu tenho um cão” pode revelar uma caixa de texto escondida para inserir o nome do cão. Outro exemplo é o botão enviar que tem que validar todos os campos antes de salvar os dados.
Ao ter essa lógica implementada

## Como Implementar

Identifique um grupo de classes firmemente acopladas que se beneficiariam de estar mais independentes (por exemplo, para uma manutenção ou reutilização mais fácil dessas classes).


Declare a interface do mediador e descreva o protocolo de comunicação desejado entre os mediadores e os diversos componentes. Na maioria dos casos, um único método para receber notificações de componentes é suficiente.
Essa interface é crucial quando você quer reutilizar classes componente em diferentes contextos. Desde que o componente trabalhe com seu mediador através da interface genérica, você pode ligar o componente com diferentes implementações do mediador.


Implemente a classe concreta do mediador. Essa classe se beneficia por armazenar referências a todos os componentes que gerencia.


Você pode ainda 

## Relações com Outros Padrões

O Chain of Responsibility, Command, Mediator e Observer abrangem várias maneiras de se conectar remetentes e destinatários de pedidos:

O Chain of Responsibility passa um pedido sequencialmente ao longo de um corrente dinâmica de potenciais destinatários até que um deles atua no pedido.
O Command estabelece conexões unidirecionais entre remetentes e destinatários.
O Mediator elimina as conexões diretas entre remetentes e destinatários, forçando-os a se comunicar indiretamente através de um objet

## Exemplo em C#

```csharp
using System;

namespace RefactoringGuru.DesignPatterns.Mediator.Conceptual
{
    // The Mediator interface declares a method used by components to notify the
    // mediator about various events. The Mediator may react to these events and
    // pass the execution to other components.
    public interface IMediator
    {
        void Notify(object sender, string ev);
    }

    // Concrete Mediators implement cooperative behavior by coordinating several
    // components.
    class ConcreteMediator : IMediator
    {
        private Component1 _component1;

        private Component2 _component2;

        public ConcreteMediator(Component1 component1, Component2 component2)
        {
            this._component1 = component1;
            this._component1.SetMediator(this);
            this._component2 = component2;
            this._component2.SetMediator(this);
        } 

        public void Notify(object sender, string ev)
        {
            if (ev == "A")
            {
                Console.WriteLine("Mediator reacts on A and triggers following operations:");
                this._component2.DoC();
            }
            if (ev == "D")
            {
                Console.WriteLine("Mediator reacts on D and triggers following operations:");
                this._component1.DoB();
                this._component2.DoC();
            }
        }
    }

    // The Base Component provides the basic functionality of storing a
    // mediator's instance inside component objects.
    class BaseComponent
    {
        protected IMediator _mediator;

        public BaseComponent(IMediator mediator = null)
        {
            this._mediator = mediator;
        }

        public void SetMediator(IMediator mediator)
        {
            this._mediator = mediator;
        }
    }

    // Concrete Components implement various functionality. They don't depend on
    // other components. They also don't depend on any concrete mediator
    // classes.
    class Component1 : BaseComponent
    {
        public void DoA()
        {
            Console.WriteLine("Component 1 does A.");

            this._mediator.Notify(this, "A");
        }

        public void DoB()
        {
            Console.WriteLine("Component 1 does B.");

            this._mediator.Notify(this, "B");
        }
    }

    class Component2 : BaseComponent
    {
        public void DoC()
        {
            Console.WriteLine("Component 2 does C.");

            this._mediator.Notify(this, "C");
        }

        public void DoD()
        {
            Console.WriteLine("Component 2 does D.");

            this._mediator.Notify(this, "D");
        }
    }
    
    class Program
    {
        static void Main(string[] args)
        {
            // The client code.
            Component1 component1 = new Component1();
            Component2 component2 = new Component2();
            new ConcreteMediator(component1, component2);

            Console.WriteLine("Client triggers operation A.");
            component1.DoA();

            Console.WriteLine();

            Console.WriteLine("Client triggers operation D.");
            component2.DoD();
        }
    }
}
```

### Output

```
Client triggers operation A.
Component 1 does A.
Mediator reacts on A and triggers following operations:
Component 2 does C.

Client triggers operation D.
Component 2 does D.
Mediator reacts on D and triggers following operations:
Component 1 does B.
Component 2 does C.
```
