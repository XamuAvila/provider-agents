# Adapter

**Categoria:** Padrões Estruturais
**Referência:** https://refactoring.guru/pt-br/design-patterns/adapter

## Propósito

O Adapter é um padrão de projeto estrutural que permite objetos com interfaces incompatíveis colaborarem entre si.

## Problema

Imagine que você está criando uma aplicação de monitoramento do mercado de ações da bolsa. A aplicação baixa os dados as ações de múltiplas fontes em formato XML e então mostra gráficos e diagramas maneiros para o usuário.
Em algum ponto, você decide melhorar a aplicação ao integrar uma biblioteca de análise de terceiros. Mas aqui está a pegadinha: a biblioteca só trabalha com dados em formato JSON.
Você poderia mudar a biblioteca para que ela funcione com XML. Contudo, isso pode quebrar algum c

## Como Implementar

Certifique-se que você tem ao menos duas classes com interfaces incompatíveis:

Uma classe serviço útil, que você não pode modificar (quase sempre de terceiros, antiga, ou com muitas dependências existentes).
Uma ou mais classes cliente que seriam beneficiadas com o uso da classe serviço.



Declare a interface cliente e descreva como o cliente se comunica com o serviço.


Cria a classe adaptadora e faça-a seguir a interface cliente. Deixe todos os métodos vazios por enquanto.


Adicione um campo para a classe do adaptador armazenar uma referência ao objeto do serviço. A prática comum é inicializar esse campo via o construtor, mas algumas vezes é mais conveniente passá-lo para o adaptador ao chamar seus métodos.


Um por um, implemente todos os métodos da interface cliente na classe adapta

## Relações com Outros Padrões

O Bridge é geralmente definido com antecedência, permitindo que você desenvolva partes de uma aplicação independentemente umas das outras. Por outro lado, o Adapter é comumente usado em aplicações existentes para fazer com que classes incompatíveis trabalhem bem juntas.


O Adapter fornece uma interface completamente diferente para acessar um objeto existente. Por outro lado, com o padrão Decorator, a interface permanece a mesma ou é estendida. Além disso, o Decorator oferece suporte à composiçã

## Exemplo em C#

```csharp
using System;

namespace RefactoringGuru.DesignPatterns.Adapter.Conceptual
{
    // The Target defines the domain-specific interface used by the client code.
    public interface ITarget
    {
        string GetRequest();
    }

    // The Adaptee contains some useful behavior, but its interface is
    // incompatible with the existing client code. The Adaptee needs some
    // adaptation before the client code can use it.
    class Adaptee
    {
        public string GetSpecificRequest()
        {
            return "Specific request.";
        }
    }

    // The Adapter makes the Adaptee's interface compatible with the Target's
    // interface.
    class Adapter : ITarget
    {
        private readonly Adaptee _adaptee;

        public Adapter(Adaptee adaptee)
        {
            this._adaptee = adaptee;
        }

        public string GetRequest()
        {
            return $"This is '{this._adaptee.GetSpecificRequest()}'";
        }
    }

    class Program
    {
        static void Main(string[] args)
        {
            Adaptee adaptee = new Adaptee();
            ITarget target = new Adapter(adaptee);

            Console.WriteLine("Adaptee interface is incompatible with the client.");
            Console.WriteLine("But with adapter client can call it's method.");

            Console.WriteLine(target.GetRequest());
        }
    }
}
```

### Output

```
Adaptee interface is incompatible with the client.
But with adapter client can call it's method.
This is 'Specific request.'
```
