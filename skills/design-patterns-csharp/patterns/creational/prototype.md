# Prototype

**Categoria:** Padrões Criacionais
**Referência:** https://refactoring.guru/pt-br/design-patterns/prototype

## Propósito

O Prototype é um padrão de projeto criacional que permite copiar objetos existentes sem fazer seu código ficar dependente de suas classes.

## Problema

Digamos que você tenha um objeto, e você quer criar uma cópia exata dele. Como você o faria? Primeiro, você tem que criar um novo objeto da mesma classe. Então você terá que ir por todos os campos do objeto original e copiar seus valores para o novo objeto.
Legal! Mas tem uma pegadinha. Nem todos os objetos podem ser copiados dessa forma porque alguns campos de objeto podem ser privados e não serão visíveis fora do próprio objeto.
Há ainda mais um problema com a abordagem direta. Uma vez que voc

## Como Implementar

Crie uma interface protótipo e declare o método clonar nela. Ou apenas adicione o método para todas as classes de uma hierarquia de classes existente, se você tiver uma.


Uma classe protótipo deve definir o construtor alternativo que aceita um objeto daquela classe como um argumento. O construtor deve copiar os valores de todos os campos definidos na classe do objeto passado para a nova instância recém criada. Se você está mudando uma subclasse, você deve chamar o construtor  da classe pai para permitir que a superclasse lide com a clonagem de seus campos privados.
Se a sua linguagem de programação não suporta sobrecarregamento de métodos, você pode definir um método especial para copiar os dados do objeto. O construtor é um local mais conveniente para se fazer isso porque ele entrega o o

## Relações com Outros Padrões

Muitos projetos começam usando o Factory Method (menos complicado e mais customizável através de subclasses) e evoluem para o Abstract Factory, Prototype, ou Builder (mais flexíveis, mas mais complicados).


Classes Abstract Factory são quase sempre baseadas em um conjunto de métodos fábrica, mas você também pode usar o Prototype para compor métodos dessas classes.


O Prototype pode ajudar quando você precisa salvar cópias de comandos no histórico.


Projetos que fazem um uso pesado de Composit

## Exemplo em C#

```csharp
using System;

namespace RefactoringGuru.DesignPatterns.Prototype.Conceptual
{
    public class Person
    {
        public int Age;
        public DateTime BirthDate;
        public string Name;
        public IdInfo IdInfo;

        public Person ShallowCopy()
        {
            return (Person) this.MemberwiseClone();
        }

        public Person DeepCopy()
        {
            Person clone = (Person) this.MemberwiseClone();
            clone.IdInfo = new IdInfo(IdInfo.IdNumber);
            clone.Name = String.Copy(Name);
            return clone;
        }
    }

    public class IdInfo
    {
        public int IdNumber;

        public IdInfo(int idNumber)
        {
            this.IdNumber = idNumber;
        }
    }

    class Program
    {
        static void Main(string[] args)
        {
            Person p1 = new Person();
            p1.Age = 42;
            p1.BirthDate = Convert.ToDateTime("1977-01-01");
            p1.Name = "Jack Daniels";
            p1.IdInfo = new IdInfo(666);

            // Perform a shallow copy of p1 and assign it to p2.
            Person p2 = p1.ShallowCopy();
            // Make a deep copy of p1 and assign it to p3.
            Person p3 = p1.DeepCopy();

            // Display values of p1, p2 and p3.
            Console.WriteLine("Original values of p1, p2, p3:");
            Console.WriteLine("   p1 instance values: ");
            DisplayValues(p1);
            Console.WriteLine("   p2 instance values:");
            DisplayValues(p2);
            Console.WriteLine("   p3 instance values:");
            DisplayValues(p3);

            // Change the value of p1 properties and display the values of p1,
            // p2 and p3.
            p1.Age = 32;
            p1.BirthDate = Convert.ToDateTime("1900-01-01");
            p1.Name = "Frank";
            p1.IdInfo.IdNumber = 7878;
            Console.WriteLine("\nValues of p1, p2 and p3 after changes to p1:");
            Console.WriteLine("   p1 instance values: ");
            DisplayValues(p1);
            Console.WriteLine("   p2 instance values (reference values have changed):");
            DisplayValues(p2);
            Console.WriteLine("   p3 instance values (everything was kept the same):");
            DisplayValues(p3);
        }

        public static void DisplayValues(Person p)
        {
            Console.WriteLine("      Name: {0:s}, Age: {1:d}, BirthDate: {2:MM/dd/yy}",
                p.Name, p.Age, p.BirthDate);
            Console.WriteLine("      ID#: {0:d}", p.IdInfo.IdNumber);
        }
    }
}
```

### Output

```
Original values of p1, p2, p3:
   p1 instance values: 
      Name: Jack Daniels, Age: 42, BirthDate: 01/01/77
      ID#: 666
   p2 instance values:
      Name: Jack Daniels, Age: 42, BirthDate: 01/01/77
      ID#: 666
   p3 instance values:
      Name: Jack Daniels, Age: 42, BirthDate: 01/01/77
      ID#: 666

Values of p1, p2 and p3 after changes to p1:
   p1 instance values: 
      Name: Frank, Age: 32, BirthDate: 01/01/00
      ID#: 7878
   p2 instance values (reference values have changed):
      Name: Jack Daniels, Age: 42, BirthDate: 01/01/77
      ID#: 7878
   p3 instance values (everything was kept the same):
      Name: Jack Daniels, Age: 42, BirthDate: 01/01/77
      ID#: 666
```
