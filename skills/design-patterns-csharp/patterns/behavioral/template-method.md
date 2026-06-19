# Template Method

**Categoria:** Padrões Comportamentais
**Referência:** https://refactoring.guru/pt-br/design-patterns/template-method

## Propósito

O Template Method é um padrão de projeto comportamental que define o esqueleto de um algoritmo na superclasse mas deixa as subclasses sobrescreverem etapas específicas do algoritmo sem modificar sua estrutura.

## Problema

Imagine que você está criando uma aplicação de mineração de dados que analisa documentos corporativos. Os usuários alimentam a aplicação com documentos em vários formatos (PDF, DOC, CSV), e ela tenta extrair dados significativos desses documentos para um formato uniforme.
A primeira versão da aplicação podia funcionar somente com arquivos DOC. Na versão seguinte, ela era capaz de suportar arquivos CSV. Um mês depois, você a “ensinou” a extrair dados de arquivos PDF.
Em algum momento você percebe

## Como Implementar

Analise o algoritmo alvo para ver se você quer quebrá-lo em etapas. Considere quais etapas são comuns a todas as subclasses e quais permanecerão únicas.


Crie a classe abstrata base e declare o método padrão e o conjunto de métodos abstratos representando as etapas do algoritmo. Contorne a estrutura do algoritmo no método padrão ao executar as etapas correspondentes. Considere tornar o método padrão como final para prevenir subclasses de sobrescrevê-lo.


Tudo bem se todas as etapas terminarem sendo abstratas. Contudo, alguns passos podem se beneficiar de ter uma implementação padrão. Subclasses não tem que implementar esses métodos.


Pense em adicionar ganchos entre as etapas cruciais do algoritmo.


Para cada variação do algoritmo, crie uma nova subclasse concreta. Ela deve implementar

## Relações com Outros Padrões

O Factory Method é uma especialização do Template Method. Ao mesmo tempo, o Factory Method pode servir como uma etapa em um Template Method grande.


O Template Method é baseado em herança: ele permite que você altere partes de um algoritmo ao estender essas partes em subclasses. O Strategy é baseado em composição: você pode alterar partes do comportamento de um objeto ao suprir ele como diferentes estratégias que correspondem a aquele comportamento. O Template Method funciona a nível de classe,

## Exemplo em C#

```csharp
using System;

namespace RefactoringGuru.DesignPatterns.TemplateMethod.Conceptual
{
    // The Abstract Class defines a template method that contains a skeleton of
    // some algorithm, composed of calls to (usually) abstract primitive
    // operations.
    //
    // Concrete subclasses should implement these operations, but leave the
    // template method itself intact.
    abstract class AbstractClass
    {
        // The template method defines the skeleton of an algorithm.
        public void TemplateMethod()
        {
            this.BaseOperation1();
            this.RequiredOperations1();
            this.BaseOperation2();
            this.Hook1();
            this.RequiredOperation2();
            this.BaseOperation3();
            this.Hook2();
        }

        // These operations already have implementations.
        protected void BaseOperation1()
        {
            Console.WriteLine("AbstractClass says: I am doing the bulk of the work");
        }

        protected void BaseOperation2()
        {
            Console.WriteLine("AbstractClass says: But I let subclasses override some operations");
        }

        protected void BaseOperation3()
        {
            Console.WriteLine("AbstractClass says: But I am doing the bulk of the work anyway");
        }
        
        // These operations have to be implemented in subclasses.
        protected abstract void RequiredOperations1();

        protected abstract void RequiredOperation2();
        
        // These are "hooks." Subclasses may override them, but it's not
        // mandatory since the hooks already have default (but empty)
        // implementation. Hooks provide additional extension points in some
        // crucial places of the algorithm.
        protected virtual void Hook1() { }

        protected virtual void Hook2() { }
    }

    // Concrete classes have to implement all abstract operations of the base
    // class. They can also override some operations with a default
    // implementation.
    class ConcreteClass1 : AbstractClass
    {
        protected override void RequiredOperations1()
        {
            Console.WriteLine("ConcreteClass1 says: Implemented Operation1");
        }

        protected override void RequiredOperation2()
        {
            Console.WriteLine("ConcreteClass1 says: Implemented Operation2");
        }
    }

    // Usually, concrete classes override only a fraction of base class'
    // operations.
    class ConcreteClass2 : AbstractClass
    {
        protected override void RequiredOperations1()
        {
            Console.WriteLine("ConcreteClass2 says: Implemented Operation1");
        }

        protected override void RequiredOperation2()
        {
            Console.WriteLine("ConcreteClass2 says: Implemented Operation2");
        }

        protected override void Hook1()
        {
            Console.WriteLine("ConcreteClass2 says: Overridden Hook1");
        }
    }

    class Client
    {
        // The client code calls the template method to execute the algorithm.
        // Client code does not have to know the concrete class of an object it
        // works with, as long as it works with objects through the interface of
        // their base class.
        public static void ClientCode(AbstractClass abstractClass)
        {
            // ...
            abstractClass.TemplateMethod();
            // ...
        }
    }

    class Program
    {
        static void Main(string[] args)
        {
            Console.WriteLine("Same client code can work with different subclasses:");

            Client.ClientCode(new ConcreteClass1());

            Console.Write("\n");
            
            Console.WriteLine("Same client code can work with different subclasses:");
            Client.ClientCode(new ConcreteClass2());
        }
    }
}
```

### Output

```
Same client code can work with different subclasses:
AbstractClass says: I am doing the bulk of the work
ConcreteClass1 says: Implemented Operation1
AbstractClass says: But I let subclasses override some operations
ConcreteClass1 says: Implemented Operation2
AbstractClass says: But I am doing the bulk of the work anyway

Same client code can work with different subclasses:
AbstractClass says: I am doing the bulk of the work
ConcreteClass2 says: Implemented Operation1
AbstractClass says: But I let subclasses override some operations
ConcreteClass2 says: Overridden Hook1
ConcreteClass2 says: Implemented Operation2
AbstractClass says: But I am doing the bulk of the work anyway
```
