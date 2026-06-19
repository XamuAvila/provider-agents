# Proxy

**Categoria:** Padrões Estruturais
**Referência:** https://refactoring.guru/pt-br/design-patterns/proxy

## Propósito

O Proxy é um padrão de projeto estrutural que permite que você forneça um substituto ou um espaço reservado para outro objeto. Um proxy controla o acesso ao objeto original, permitindo que você faça algo ou antes ou depois do pedido chegar ao objeto original.

## Problema

Por que eu iria querer controlar o acesso a um objeto? Aqui está um exemplo: você tem um objeto grande que consome muitos recursos do sistema. Você precisa dele de tempos em tempos, mas não sempre.
Você poderia implementar uma inicialização preguiçosa: criar esse objeto apenas quando ele é realmente necessário. Todos os clientes do objeto teriam que executar algum código adiado de inicialização. Infelizmente, isso provavelmente resultaria em muito código duplicado.
Em um mundo ideal, gostaríamos

## Como Implementar

Se não há uma interface do serviço pré existente, crie uma para fazer os objetos proxy e serviço intercomunicáveis. Extrair a interface da classe serviço nem sempre é possível, porque você precisaria mudar todos os clientes do serviço para usar aquela interface. O plano B é fazer do proxy uma subclasse da classe serviço e, dessa forma, ele herdará a interface do serviço.


Crie a classe proxy. Ela deve ter um campo para armazenar uma referência ao serviço. Geralmente proxies criam e gerenciam todo o ciclo de vida de seus serviços. Em raras ocasiões, um serviço é passado ao proxy através do construtor pelo cliente.


Implemente os métodos proxy de acordo com o propósito deles. Na maioria dos casos, após realizar algum trabalho, o proxy deve delegar o trabalho para o objeto do serviço.


Con

## Relações com Outros Padrões

Com Adapter, você acessa um objeto existente por meio de uma interface diferente. Com Proxy, a interface permanece a mesma. Com Decorator, você acessa o objeto por meio de uma interface aprimorada.


O Facade é parecido como o Proxy no quesito que ambos colocam em buffer uma entidade complexa e inicializam ela sozinhos. Ao contrário do Facade, o Proxy tem a mesma interface que seu objeto de serviço, o que os torna intermutáveis.


O Decorator e o Proxy têm estruturas semelhantes, mas propósitos 

## Exemplo em C#

```csharp
using System;

namespace RefactoringGuru.DesignPatterns.Proxy.Conceptual
{
    // The Subject interface declares common operations for both RealSubject and
    // the Proxy. As long as the client works with RealSubject using this
    // interface, you'll be able to pass it a proxy instead of a real subject.
    public interface ISubject
    {
        void Request();
    }
    
    // The RealSubject contains some core business logic. Usually, RealSubjects
    // are capable of doing some useful work which may also be very slow or
    // sensitive - e.g. correcting input data. A Proxy can solve these issues
    // without any changes to the RealSubject's code.
    class RealSubject : ISubject
    {
        public void Request()
        {
            Console.WriteLine("RealSubject: Handling Request.");
        }
    }
    
    // The Proxy has an interface identical to the RealSubject.
    class Proxy : ISubject
    {
        private RealSubject _realSubject;
        
        public Proxy(RealSubject realSubject)
        {
            this._realSubject = realSubject;
        }
        
        // The most common applications of the Proxy pattern are lazy loading,
        // caching, controlling the access, logging, etc. A Proxy can perform
        // one of these things and then, depending on the result, pass the
        // execution to the same method in a linked RealSubject object.
        public void Request()
        {
            if (this.CheckAccess())
            {
                this._realSubject.Request();

                this.LogAccess();
            }
        }
		
        public bool CheckAccess()
        {
            // Some real checks should go here.
            Console.WriteLine("Proxy: Checking access prior to firing a real request.");

            return true;
        }
		
        public void LogAccess()
        {
            Console.WriteLine("Proxy: Logging the time of request.");
        }
    }
    
    public class Client
    {
        // The client code is supposed to work with all objects (both subjects
        // and proxies) via the Subject interface in order to support both real
        // subjects and proxies. In real life, however, clients mostly work with
        // their real subjects directly. In this case, to implement the pattern
        // more easily, you can extend your proxy from the real subject's class.
        public void ClientCode(ISubject subject)
        {
            // ...
            
            subject.Request();
            
            // ...
        }
    }
    
    class Program
    {
        static void Main(string[] args)
        {
            Client client = new Client();
            
            Console.WriteLine("Client: Executing the client code with a real subject:");
            RealSubject realSubject = new RealSubject();
            client.ClientCode(realSubject);

            Console.WriteLine();

            Console.WriteLine("Client: Executing the same client code with a proxy:");
            Proxy proxy = new Proxy(realSubject);
            client.ClientCode(proxy);
        }
    }
}
```

### Output

```
Client: Executing the client code with a real subject:
RealSubject: Handling Request.

Client: Executing the same client code with a proxy:
Proxy: Checking access prior to firing a real request.
RealSubject: Handling Request.
Proxy: Logging the time of request.
```
