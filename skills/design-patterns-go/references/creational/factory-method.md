# Factory Method (Go)

**Categoria:** Creational  
**Fonte:** https://refactoring.guru/pt-br/design-patterns/factory-method/go/example

## Intenção

O Factory method é um padrão de projeto criacional, que resolve o problema de criar objetos de produtos sem especificar suas classes concretas.

O Factory Method define um método, que deve ser usado para criar objetos em vez da chamada direta ao construtor (operador new ). As subclasses podem substituir esse método para alterar a classe de objetos que serão criados.

## Contexto do Exemplo

Se você não conseguir descobrir a diferença entre os padrões Factory , Factory Method e Abstract Factory , leia nossa Comparação Factory .

É impossível implementar o padrão Factory Method clássico no Go devido à falta de recursos OOP, como classes e herança. No entanto, ainda podemos implementar a versão básica do padrão, o Factory Simples.

Neste exemplo, vamos construir vários tipos de armas usando uma struct factory.

## Implementação em Go

### `igun.go`

```go
package main

type IGun interface {
	setName(name string)
	setPower(power int)
	getName() string
	getPower() int
}
```

### `gun.go` — Produto concreto

```go
package main

type Gun struct {
	name  string
	power int
}

func (g *Gun) setName(name string) {
	g.name = name
}

func (g *Gun) getName() string {
	return g.name
}

func (g *Gun) setPower(power int) {
	g.power = power
}

func (g *Gun) getPower() int {
	return g.power
}
```

### `ak47.go`

```go
package main

type Ak47 struct {
	Gun
}

func newAk47() IGun {
	return &Ak47{
		Gun: Gun{
			name:  "AK47 gun",
			power: 4,
		},
	}
}
```

### `musket.go` — Produto concreto

```go
package main

type musket struct {
	Gun
}

func newMusket() IGun {
	return &musket{
		Gun: Gun{
			name:  "Musket gun",
			power: 1,
		},
	}
}
```

### `part_5.go`

```go
package main

import "fmt"

func getGun(gunType string) (IGun, error) {
	if gunType == "ak47" {
		return newAk47(), nil
	}
	if gunType == "musket" {
		return newMusket(), nil
	}
	return nil, fmt.Errorf("Wrong gun type passed")
}
```

### `main.go` — Código cliente

```go
package main

import "fmt"

func main() {
	ak47, _ := getGun("ak47")
	musket, _ := getGun("musket")

	printDetails(ak47)
	printDetails(musket)
}

func printDetails(g IGun) {
	fmt.Printf("Gun: %s", g.getName())
	fmt.Println()
	fmt.Printf("Power: %d", g.getPower())
	fmt.Println()
}
```
