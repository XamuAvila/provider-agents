# Iterator

**Categoria:** Padrões Comportamentais
**Referência:** https://refactoring.guru/pt-br/design-patterns/iterator

## Propósito

O Iterator é um padrão de projeto comportamental que permite a você percorrer elementos de uma coleção sem expor as representações dele (lista, pilha, árvore, etc.)

## Problema

Coleções são um dos tipos de dados mais usados em programação. Não obstante, uma coleção é apenas um contêiner para um grupo de objetos.
A maioria das coleções armazena seus elementos em listas simples. Contudo, alguns deles são baseados em pilhas, árvores, grafos, e outras estruturas complexas de dados.
Mas independente de quão complexa uma coleção é estruturada, ela deve fornecer uma maneira de acessar seus elementos para que outro código possa usá-los. Deve haver uma maneira de ir de elemento

## Como Implementar

Declare a interface do iterador. Ao mínimo, ela deve ter um método para buscar o próximo elemento de uma coleção. Mas por motivos de conveniência você pode adicionar alguns outros métodos, tais como recuperar o elemento anterior, saber a posição atual, e checar o fim da iteração.


Declare a interface da coleção e descreva um método para buscar iteradores. O tipo de retorno deve ser igual à interface do iterador. Você pode declarar métodos parecidos se você planeja ter grupos distintos de iteradores.


Implemente classes iterador concretas para as coleções que você quer percorrer com iteradores. Um objeto iterador deve ser ligado com uma única instância de coleção. Geralmente esse link é estabelecido através do construtor do iterador.


Implemente a interface da coleção na suas classes de 

## Relações com Outros Padrões

Você pode usar Iteradores para percorrer árvores Composite.


Você pode usar o Factory Method junto com o Iterator para permitir que uma coleção de subclasses retornem diferentes tipos de iteradores que são compatíveis com as coleções.


Você pode usar o Memento junto com o Iterator para capturar o estado de iteração atual e revertê-lo se necessário.


Você pode usar o Visitor junto com o Iterator para percorrer uma estrutura de dados complexas e executar alguma operação sobre seus elementos, me

## Exemplo em C#

```csharp
using System;
using System.Collections;
using System.Collections.Generic;

namespace RefactoringGuru.DesignPatterns.Iterator.Conceptual
{
    abstract class Iterator : IEnumerator
    {
        object IEnumerator.Current => Current();

        // Returns the key of the current element
        public abstract int Key();
		
        // Returns the current element
        public abstract object Current();
		
        // Move forward to next element
        public abstract bool MoveNext();
		
        // Rewinds the Iterator to the first element
        public abstract void Reset();
    }

    abstract class IteratorAggregate : IEnumerable
    {
        // Returns an Iterator or another IteratorAggregate for the implementing
        // object.
        public abstract IEnumerator GetEnumerator();
    }

    // Concrete Iterators implement various traversal algorithms. These classes
    // store the current traversal position at all times.
    class AlphabeticalOrderIterator : Iterator
    {
        private WordsCollection _collection;
		
        // Stores the current traversal position. An iterator may have a lot of
        // other fields for storing iteration state, especially when it is
        // supposed to work with a particular kind of collection.
        private int _position = -1;
		
        private bool _reverse = false;

        public AlphabeticalOrderIterator(WordsCollection collection, bool reverse = false)
        {
            this._collection = collection;
            this._reverse = reverse;

            if (reverse)
            {
                this._position = collection.getItems().Count;
            }
        }
		
        public override object Current()
        {
            return this._collection.getItems()[_position];
        }

        public override int Key()
        {
            return this._position;
        }
		
        public override bool MoveNext()
        {
            int updatedPosition = this._position + (this._reverse ? -1 : 1);

            if (updatedPosition >= 0 && updatedPosition < this._collection.getItems().Count)
            {
                this._position = updatedPosition;
                return true;
            }
            else
            {
                return false;
            }
        }
		
        public override void Reset()
        {
            this._position = this._reverse ? this._collection.getItems().Count - 1 : 0;
        }
    }

    // Concrete Collections provide one or several methods for retrieving fresh
    // iterator instances, compatible with the collection class.
    class WordsCollection : IteratorAggregate
    {
        List<string> _collection = new List<string>();
		
        bool _direction = false;
        
        public void ReverseDirection()
        {
            _direction = !_direction;
        }
		
        public List<string> getItems()
        {
            return _collection;
        }
		
        public void AddItem(string item)
        {
            this._collection.Add(item);
        }
		
        public override IEnumerator GetEnumerator()
        {
            return new AlphabeticalOrderIterator(this, _direction);
        }
    }

    class Program
    {
        static void Main(string[] args)
        {
            // The client code may or may not know about the Concrete Iterator
            // or Collection classes, depending on the level of indirection you
            // want to keep in your program.
            var collection = new WordsCollection();
            collection.AddItem("First");
            collection.AddItem("Second");
            collection.AddItem("Third");

            Console.WriteLine("Straight traversal:");

            foreach (var element in collection)
            {
                Console.WriteLine(element);
            }

            Console.WriteLine("\nReverse traversal:");

            collection.ReverseDirection();

            foreach (var element in collection)
            {
                Console.WriteLine(element);
            }
        }
    }
}
```

### Output

```
Straight traversal:
First
Second
Third

Reverse traversal:
Third
Second
First
```
