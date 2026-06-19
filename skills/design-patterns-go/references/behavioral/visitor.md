# Visitor (Go)

**Categoria:** Behavioral  
**Fonte:** https://refactoring.guru/pt-br/design-patterns/visitor/go/example

## Intenção

O Visitor é um padrão de projeto comportamental que permite adicionar novos comportamentos à hierarquia de classes existente sem alterar nenhum código existente.

Leia por que os Visitors não podem ser simplesmente substituídos pela sobrecarga de método em nosso artigo Visitor e Double Dispatch .

## Contexto do Exemplo

O padrão Visitor permite adicionar comportamento a uma struct sem realmente modificar a struct. Digamos que você seja o mantenedor de uma biblioteca que tem structs de formatos diferentes, como:

Cada uma das structs de forma acima implementa a interface de forma comum.

Depois que as pessoas em sua empresa começaram a usar sua biblioteca incrível, você foi inundado com solicitações de recursos. Vamos revisar um dos mais simples: uma equipe solicitou que você adicionasse o comportamento getArea às structs de forma.

## Implementação em Go

### `shape.go` — Elemento

```go
package main

type Shape interface {
	getType() string
	accept(Visitor)
}
```

### `square.go` — Elemento concreto

```go
package main

type Square struct {
	side int
}

func (s *Square) accept(v Visitor) {
	v.visitForSquare(s)
}

func (s *Square) getType() string {
	return "Square"
}
```

### `circle.go` — Elemento concreto

```go
package main

type Circle struct {
	radius int
}

func (c *Circle) accept(v Visitor) {
	v.visitForCircle(c)
}

func (c *Circle) getType() string {
	return "Circle"
}
```

### `rectangle.go` — Elemento concreto

```go
package main

type Rectangle struct {
	l int
	b int
}

func (t *Rectangle) accept(v Visitor) {
	v.visitForrectangle(t)
}

func (t *Rectangle) getType() string {
	return "rectangle"
}
```

### `visitor.go` — Visitor

```go
package main

type Visitor interface {
	visitForSquare(*Square)
	visitForCircle(*Circle)
	visitForrectangle(*Rectangle)
}
```

### `areacalculator.go`

```go
package main

import (
	"fmt"
)

type AreaCalculator struct {
	area int
}

func (a *AreaCalculator) visitForSquare(s *Square) {
	// Calculate area for square.
	// Then assign in to the area instance variable.
	fmt.Println("Calculating area for square")
}

func (a *AreaCalculator) visitForCircle(s *Circle) {
	fmt.Println("Calculating area for circle")
}
func (a *AreaCalculator) visitForrectangle(s *Rectangle) {
	fmt.Println("Calculating area for rectangle")
}
```

### `middlecoordinates.go`

```go
package main

import "fmt"

type MiddleCoordinates struct {
	x int
	y int
}

func (a *MiddleCoordinates) visitForSquare(s *Square) {
	// Calculate middle point coordinates for square.
	// Then assign in to the x and y instance variable.
	fmt.Println("Calculating middle point coordinates for square")
}

func (a *MiddleCoordinates) visitForCircle(c *Circle) {
	fmt.Println("Calculating middle point coordinates for circle")
}
func (a *MiddleCoordinates) visitForrectangle(t *Rectangle) {
	fmt.Println("Calculating middle point coordinates for rectangle")
}
```

### `main.go` — Código cliente

```go
package main

import "fmt"

func main() {
	square := &Square{side: 2}
	circle := &Circle{radius: 3}
	rectangle := &Rectangle{l: 2, b: 3}

	areaCalculator := &AreaCalculator{}

	square.accept(areaCalculator)
	circle.accept(areaCalculator)
	rectangle.accept(areaCalculator)

	fmt.Println()
	middleCoordinates := &MiddleCoordinates{}
	square.accept(middleCoordinates)
	circle.accept(middleCoordinates)
	rectangle.accept(middleCoordinates)
}
```
