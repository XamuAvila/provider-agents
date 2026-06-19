# Command

**Categoria:** Padrões Comportamentais
**Referência:** https://refactoring.guru/pt-br/design-patterns/command

## Propósito

O Command é um padrão de projeto comportamental que transforma um pedido em um objeto independente que contém toda a informação sobre o pedido. Essa transformação permite que você parameterize métodos com diferentes pedidos, atrase ou coloque a execução do pedido em uma fila, e suporte operações que não podem ser feitas.

## Problema

Imagine que você está trabalhando em uma nova aplicação de editor de texto. Sua tarefa atual é criar uma barra de tarefas com vários botões para várias operações do editor. Você criou uma classe Botão muito bacana que pode ser usada para botões na barra de tarefas, bem como para botões genéricos de diversas caixas de diálogo.
Embora todos esses botões pareçam similares, eles todos devem fazer coisas diferentes. Aonde você deveria colocar o código para os vários handlers de cliques desses botões?

## Como Implementar

Declare a interface comando com um único método de execução.


Comece extraindo pedidos para dentro de classes concretas comando que implementam a interface comando. Cada classe deve ter um conjunto de campos para armazenar os argumentos dos pedidos junto com uma referência ao objeto destinatário real. Todos esses valores devem ser inicializados através do construtor do comando.


Identifique classes que vão agir como remetentes. Adicione os campos para armazenar comandos nessas classes. Remetentes devem sempre comunicar-se com seus comandos através da interface comando. Remetentes geralmente não criam objetos comando por conta própria, mas devem obtê-los do código cliente.


Mude os remetentes para que executem o comando ao invés de enviar o pedido para o destinatário diretamente.


O cli

## Relações com Outros Padrões

O Chain of Responsibility, Command, Mediator e Observer abrangem várias maneiras de se conectar remetentes e destinatários de pedidos:

O Chain of Responsibility passa um pedido sequencialmente ao longo de um corrente dinâmica de potenciais destinatários até que um deles atua no pedido.
O Command estabelece conexões unidirecionais entre remetentes e destinatários.
O Mediator elimina as conexões diretas entre remetentes e destinatários, forçando-os a se comunicar indiretamente através de um objet

## Exemplo em C#

```csharp
using System;

namespace RefactoringGuru.DesignPatterns.Command.Conceptual
{
    // The Command interface declares a method for executing a command.
    public interface ICommand
    {
        void Execute();
    }

    // Some commands can implement simple operations on their own.
    class SimpleCommand : ICommand
    {
        private string _payload = string.Empty;

        public SimpleCommand(string payload)
        {
            this._payload = payload;
        }

        public void Execute()
        {
            Console.WriteLine($"SimpleCommand: See, I can do simple things like printing ({this._payload})");
        }
    }

    // However, some commands can delegate more complex operations to other
    // objects, called "receivers."
    class ComplexCommand : ICommand
    {
        private Receiver _receiver;

        // Context data, required for launching the receiver's methods.
        private string _a;

        private string _b;

        // Complex commands can accept one or several receiver objects along
        // with any context data via the constructor.
        public ComplexCommand(Receiver receiver, string a, string b)
        {
            this._receiver = receiver;
            this._a = a;
            this._b = b;
        }

        // Commands can delegate to any methods of a receiver.
        public void Execute()
        {
            Console.WriteLine("ComplexCommand: Complex stuff should be done by a receiver object.");
            this._receiver.DoSomething(this._a);
            this._receiver.DoSomethingElse(this._b);
        }
    }

    // The Receiver classes contain some important business logic. They know how
    // to perform all kinds of operations, associated with carrying out a
    // request. In fact, any class may serve as a Receiver.
    class Receiver
    {
        public void DoSomething(string a)
        {
            Console.WriteLine($"Receiver: Working on ({a}.)");
        }

        public void DoSomethingElse(string b)
        {
            Console.WriteLine($"Receiver: Also working on ({b}.)");
        }
    }

    // The Invoker is associated with one or several commands. It sends a
    // request to the command.
    class Invoker
    {
        private ICommand _onStart;

        private ICommand _onFinish;

        // Initialize commands.
        public void SetOnStart(ICommand command)
        {
            this._onStart = command;
        }

        public void SetOnFinish(ICommand command)
        {
            this._onFinish = command;
        }

        // The Invoker does not depend on concrete command or receiver classes.
        // The Invoker passes a request to a receiver indirectly, by executing a
        // command.
        public void DoSomethingImportant()
        {
            Console.WriteLine("Invoker: Does anybody want something done before I begin?");
            if (this._onStart is ICommand)
            {
                this._onStart.Execute();
            }
            
            Console.WriteLine("Invoker: ...doing something really important...");
            
            Console.WriteLine("Invoker: Does anybody want something done after I finish?");
            if (this._onFinish is ICommand)
            {
                this._onFinish.Execute();
            }
        }
    }

    class Program
    {
        static void Main(string[] args)
        {
            // The client code can parameterize an invoker with any commands.
            Invoker invoker = new Invoker();
            invoker.SetOnStart(new SimpleCommand("Say Hi!"));
            Receiver receiver = new Receiver();
            invoker.SetOnFinish(new ComplexCommand(receiver, "Send email", "Save report"));

            invoker.DoSomethingImportant();
        }
    }
}
```

### Output

```
Invoker: Does anybody want something done before I begin?
SimpleCommand: See, I can do simple things like printing (Say Hi!)
Invoker: ...doing something really important...
Invoker: Does anybody want something done after I finish?
ComplexCommand: Complex stuff should be done by a receiver object.
Receiver: Working on (Send email.)
Receiver: Also working on (Save report.)
```
