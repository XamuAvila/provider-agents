# Abstract Factory

**Categoria:** Padrões Criacionais
**Referência:** https://refactoring.guru/pt-br/design-patterns/abstract-factory

## Propósito

O Abstract Factory é um padrão de projeto criacional que permite que você produza famílias de objetos relacionados sem ter que especificar suas classes concretas.

## Problema

Imagine que você está criando um simulador de loja de mobílias. Seu código consiste de classes que representam:
Uma família de produtos relacionados, como: Cadeira + Sofá + MesaDeCentro.


Várias variantes dessa família. Por exemplo, produtos Cadeira + Sofá + MesaDeCentro estão disponíveis nessas variantes: Moderno, Vitoriano, ArtDeco.
Você precisa de um jeito de criar objetos de mobília individuais para que eles combinem com outros objetos da mesma família. Os clientes ficam muito bravos quando

## Como Implementar

Mapeie uma matriz de tipos de produtos distintos versus as variantes desses produtos.


Declare interfaces de produto abstratas para todos os tipos de produto. Então, faça todas as classes concretas de produtos implementar essas interfaces.


Declare a interface da fábrica abstrata com um conjuntos de métodos de criação para todos os produtos abstratos.


Implemente um conjunto de classes fábricas concretas, uma para cada variante de produto.


Crie um código de inicialização da fábrica em algum lugar da aplicação. Ele deve instanciar uma das classes fábrica concretas, dependendo da configuração da aplicação ou do ambiente atual. Passe esse objeto fábrica para todas as classes que constroem produtos.


Escaneie o código e encontre todas as chamadas diretas para construtores de produtos. Su

## Relações com Outros Padrões

Muitos projetos começam usando o Factory Method (menos complicado e mais customizável através de subclasses) e evoluem para o Abstract Factory, Prototype, ou Builder (mais flexíveis, mas mais complicados).


O Builder foca em construir objetos complexos passo a passo. O Abstract Factory se especializa em criar famílias de objetos relacionados. O Abstract Factory retorna o produto imediatamente, enquanto que o Builder permite que você execute algumas etapas de construção antes de buscar o produto

## Exemplo em C#

```csharp
using System;

namespace RefactoringGuru.DesignPatterns.AbstractFactory.Conceptual
{
    // The Abstract Factory interface declares a set of methods that return
    // different abstract products. These products are called a family and are
    // related by a high-level theme or concept. Products of one family are
    // usually able to collaborate among themselves. A family of products may
    // have several variants, but the products of one variant are incompatible
    // with products of another.
    public interface IAbstractFactory
    {
        IAbstractProductA CreateProductA();

        IAbstractProductB CreateProductB();
    }

    // Concrete Factories produce a family of products that belong to a single
    // variant. The factory guarantees that resulting products are compatible.
    // Note that signatures of the Concrete Factory's methods return an abstract
    // product, while inside the method a concrete product is instantiated.
    class ConcreteFactory1 : IAbstractFactory
    {
        public IAbstractProductA CreateProductA()
        {
            return new ConcreteProductA1();
        }

        public IAbstractProductB CreateProductB()
        {
            return new ConcreteProductB1();
        }
    }

    // Each Concrete Factory has a corresponding product variant.
    class ConcreteFactory2 : IAbstractFactory
    {
        public IAbstractProductA CreateProductA()
        {
            return new ConcreteProductA2();
        }

        public IAbstractProductB CreateProductB()
        {
            return new ConcreteProductB2();
        }
    }

    // Each distinct product of a product family should have a base interface.
    // All variants of the product must implement this interface.
    public interface IAbstractProductA
    {
        string UsefulFunctionA();
    }

    // Concrete Products are created by corresponding Concrete Factories.
    class ConcreteProductA1 : IAbstractProductA
    {
        public string UsefulFunctionA()
        {
            return "The result of the product A1.";
        }
    }

    class ConcreteProductA2 : IAbstractProductA
    {
        public string UsefulFunctionA()
        {
            return "The result of the product A2.";
        }
    }

    // Here's the the base interface of another product. All products can
    // interact with each other, but proper interaction is possible only between
    // products of the same concrete variant.
    public interface IAbstractProductB
    {
        // Product B is able to do its own thing...
        string UsefulFunctionB();

        // ...but it also can collaborate with the ProductA.
        //
        // The Abstract Factory makes sure that all products it creates are of
        // the same variant and thus, compatible.
        string AnotherUsefulFunctionB(IAbstractProductA collaborator);
    }

    // Concrete Products are created by corresponding Concrete Factories.
    class ConcreteProductB1 : IAbstractProductB
    {
        public string UsefulFunctionB()
        {
            return "The result of the product B1.";
        }

        // The variant, Product B1, is only able to work correctly with the
        // variant, Product A1. Nevertheless, it accepts any instance of
        // AbstractProductA as an argument.
        public string AnotherUsefulFunctionB(IAbstractProductA collaborator)
        {
            var result = collaborator.UsefulFunctionA();

            return $"The result of the B1 collaborating with the ({result})";
        }
    }

    class ConcreteProductB2 : IAbstractProductB
    {
        public string UsefulFunctionB()
        {
            return "The result of the product B2.";
        }

       // The variant, Product B2, is only able to work correctly with the
       // variant, Product A2. Nevertheless, it accepts any instance of
       // AbstractProductA as an argument.
        public string AnotherUsefulFunctionB(IAbstractProductA collaborator)
        {
            var result = collaborator.UsefulFunctionA();

            return $"The result of the B2 collaborating with the ({result})";
        }
    }

    // The client code works with factories and products only through abstract
    // types: AbstractFactory and AbstractProduct. This lets you pass any
    // factory or product subclass to the client code without breaking it.
    class Client
    {
        public void Main()
        {
            // The client code can work with any concrete factory class.
            Console.WriteLine("Client: Testing client code with the first factory type...");
            ClientMethod(new ConcreteFactory1());
            Console.WriteLine();

            Console.WriteLine("Client: Testing the same client code with the second factory type...");
            ClientMethod(new ConcreteFactory2());
        }

        public void ClientMethod(IAbstractFactory factory)
        {
            var productA = factory.CreateProductA();
            var productB = factory.CreateProductB();

            Console.WriteLine(productB.UsefulFunctionB());
            Console.WriteLine(productB.AnotherUsefulFunctionB(productA));
        }
    }

    class Program
    {
        static void Main(string[] args)
        {
            new Client().Main();
        }
    }
}
```

### Output

```
Client: Testing client code with the first factory type...
The result of the product B1.
The result of the B1 collaborating with the (The result of the product A1.)

Client: Testing the same client code with the second factory type...
The result of the product B2.
The result of the B2 collaborating with the (The result of the product A2.)
```
