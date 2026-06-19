# Memento

**Categoria:** Padrões Comportamentais
**Referência:** https://refactoring.guru/pt-br/design-patterns/memento

## Propósito

O Memento é um padrão de projeto comportamental que permite que você salve e restaure o estado anterior de um objeto sem revelar os detalhes de sua implementação.

## Problema

Imagine que você está criando uma aplicação de editor de texto. Além da simples edição de texto, seu editor pode formatar o texto, inserir imagens em linha, etc.
Em determinado momento você decide permitir que os usuários desfaçam quaisquer operações realizadas no texto. Essa funcionalidade tem se tornado tão comum nos últimos anos que, hoje em dia, as pessoas esperam que toda aplicação a tenha. Para a implementação você decide usar a abordagem direta. Antes de realizar qualquer operação, a apli

## Como Implementar

Determine qual classe vai fazer o papel de originadora. É importante saber se o programa usa um objeto central deste tipo ou múltiplos objetos pequenos.


Crie a classe memento. Um por um, declare o conjunto dos campos que espelham os campos declarados dentro da classe originadora.


Faça a classe memento ser imutável. Um memento deve aceitar os dados apenas uma vez, através do construtor. A classe não deve ter setters.


Se a sua linguagem de programação suporta classes aninhadas, aninhe o memento dentro da originadora. Se não, extraia uma interface em branco da classe memento e faça todos os outros objetos usá-la para se referir ao memento. Você pode adicionar algumas operações de metadados para a interface, mas nada que exponha o estado da originadora.


Adicione um método para produção

## Relações com Outros Padrões

Você pode usar o Command e o Memento juntos quando implementando um “desfazer”. Neste caso, os comandos são responsáveis pela realização de várias operações sobre um objeto alvo, enquanto que os mementos salvam o estado daquele objeto momentos antes de um comando ser executado.


Você pode usar o Memento junto com o Iterator para capturar o estado de iteração atual e revertê-lo se necessário.


Algumas vezes o Prototype pode ser uma alternativa mais simples a um Memento. Isso funciona se o objet

## Exemplo em C#

```csharp
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;

namespace RefactoringGuru.DesignPatterns.Memento.Conceptual
{
    // The Originator holds some important state that may change over time. It
    // also defines a method for saving the state inside a memento and another
    // method for restoring the state from it.
    class Originator
    {
        // For the sake of simplicity, the originator's state is stored inside a
        // single variable.
        private string _state;

        public Originator(string state)
        {
            this._state = state;
            Console.WriteLine("Originator: My initial state is: " + state);
        }

        // The Originator's business logic may affect its internal state.
        // Therefore, the client should backup the state before launching
        // methods of the business logic via the save() method.
        public void DoSomething()
        {
            Console.WriteLine("Originator: I'm doing something important.");
            this._state = this.GenerateRandomString(30);
            Console.WriteLine($"Originator: and my state has changed to: {_state}");
        }

        private string GenerateRandomString(int length = 10)
        {
            string allowedSymbols = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
            string result = string.Empty;

            while (length > 0)
            {
                result += allowedSymbols[new Random().Next(0, allowedSymbols.Length)];

                Thread.Sleep(12);

                length--;
            }

            return result;
        }

        // Saves the current state inside a memento.
        public IMemento Save()
        {
            return new ConcreteMemento(this._state);
        }

        // Restores the Originator's state from a memento object.
        public void Restore(IMemento memento)
        {
            if (!(memento is ConcreteMemento))
            {
                throw new Exception("Unknown memento class " + memento.ToString());
            }

            this._state = memento.GetState();
            Console.Write($"Originator: My state has changed to: {_state}");
        }
    }

    // The Memento interface provides a way to retrieve the memento's metadata,
    // such as creation date or name. However, it doesn't expose the
    // Originator's state.
    public interface IMemento
    {
        string GetName();

        string GetState();

        DateTime GetDate();
    }

    // The Concrete Memento contains the infrastructure for storing the
    // Originator's state.
    class ConcreteMemento : IMemento
    {
        private string _state;

        private DateTime _date;

        public ConcreteMemento(string state)
        {
            this._state = state;
            this._date = DateTime.Now;
        }

        // The Originator uses this method when restoring its state.
        public string GetState()
        {
            return this._state;
        }
        
        // The rest of the methods are used by the Caretaker to display
        // metadata.
        public string GetName()
        {
            return $"{this._date} / ({this._state.Substring(0, 9)})...";
        }

        public DateTime GetDate()
        {
            return this._date;
        }
    }

    // The Caretaker doesn't depend on the Concrete Memento class. Therefore, it
    // doesn't have access to the originator's state, stored inside the memento.
    // It works with all mementos via the base Memento interface.
    class Caretaker
    {
        private List<IMemento> _mementos = new List<IMemento>();

        private Originator _originator = null;

        public Caretaker(Originator originator)
        {
            this._originator = originator;
        }

        public void Backup()
        {
            Console.WriteLine("\nCaretaker: Saving Originator's state...");
            this._mementos.Add(this._originator.Save());
        }

        public void Undo()
        {
            if (this._mementos.Count == 0)
            {
                return;
            }

            var memento = this._mementos.Last();
            this._mementos.Remove(memento);

            Console.WriteLine("Caretaker: Restoring state to: " + memento.GetName());

            try
            {
                this._originator.Restore(memento);
            }
            catch (Exception)
            {
                this.Undo();
            }
        }

        public void ShowHistory()
        {
            Console.WriteLine("Caretaker: Here's the list of mementos:");

            foreach (var memento in this._mementos)
            {
                Console.WriteLine(memento.GetName());
            }
        }
    }
    
    class Program
    {
        static void Main(string[] args)
        {
            // Client code.
            Originator originator = new Originator("Super-duper-super-puper-super.");
            Caretaker caretaker = new Caretaker(originator);

            caretaker.Backup();
            originator.DoSomething();

            caretaker.Backup();
            originator.DoSomething();

            caretaker.Backup();
            originator.DoSomething();

            Console.WriteLine();
            caretaker.ShowHistory();

            Console.WriteLine("\nClient: Now, let's rollback!\n");
            caretaker.Undo();

            Console.WriteLine("\n\nClient: Once more!\n");
            caretaker.Undo();

            Console.WriteLine();
        }
    }
}
```

### Output

```
Originator: My initial state is: Super-duper-super-puper-super.

Caretaker: Saving Originator's state...
Originator: I'm doing something important.
Originator: and my state has changed to: oGyQIIatlDDWNgYYqJATTmdwnnGZQj

Caretaker: Saving Originator's state...
Originator: I'm doing something important.
Originator: and my state has changed to: jBtMDDWogzzRJbTTmEwOOhZrjjBULe

Caretaker: Saving Originator's state...
Originator: I'm doing something important.
Originator: and my state has changed to: exoHyyRkbuuNEXOhhArKccUmexPPHZ

Caretaker: Here's the list of mementos:
12.06.2018 15:52:45 / (Super-dup...)
12.06.2018 15:52:46 / (oGyQIIatl...)
12.06.2018 15:52:46 / (jBtMDDWog...)

Client: Now, let's rollback!

Caretaker: Restoring state to: 12.06.2018 15:52:46 / (jBtMDDWog...)
Originator: My state has changed to: jBtMDDWogzzRJbTTmEwOOhZrjjBULe

Client: Once more!

Caretaker: Restoring state to: 12.06.2018 15:52:46 / (oGyQIIatl...)
Originator: My state has changed to: oGyQIIatlDDWNgYYqJATTmdwnnGZQj
```
