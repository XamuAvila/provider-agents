# Decorator (Go)

**Categoria:** Structural  
**Fonte:** https://refactoring.guru/pt-br/design-patterns/decorator/go/example

## Intenção

O Decorator é um padrão estrutural que permite adicionar novos comportamentos aos objetos dinamicamente, colocando-os dentro de objetos wrapper especiais.

Usando decoradores, você pode agrupar objetos inúmeras vezes, pois os objetos de destino e os decoradores seguem a mesma interface. O objeto resultante terá um comportamento de empilhamento de todos os wrappers.

## Implementação em Go

### `pizza.go` — Interface de componente

```go
package main

type IPizza interface {
	getPrice() int
}
```

### `veggiemania.go`

```go
package main

type VeggieMania struct {
}

func (p *VeggieMania) getPrice() int {
	return 15
}
```

### `tomatotopping.go`

```go
package main

type TomatoTopping struct {
	pizza IPizza
}

func (c *TomatoTopping) getPrice() int {
	pizzaPrice := c.pizza.getPrice()
	return pizzaPrice + 7
}
```

### `cheesetopping.go`

```go
package main

type CheeseTopping struct {
	pizza IPizza
}

func (c *CheeseTopping) getPrice() int {
	pizzaPrice := c.pizza.getPrice()
	return pizzaPrice + 10
}
```

### `main.go` — Código cliente

```go
package main

import "fmt"

func main() {

	pizza := &VeggieMania{}

	//Add cheese topping
	pizzaWithCheese := &CheeseTopping{
		pizza: pizza,
	}

	//Add tomato topping
	pizzaWithCheeseAndTomato := &TomatoTopping{
		pizza: pizzaWithCheese,
	}

	fmt.Printf("Price of veggeMania with tomato and cheese topping is %d\n", pizzaWithCheeseAndTomato.getPrice())
}
```
