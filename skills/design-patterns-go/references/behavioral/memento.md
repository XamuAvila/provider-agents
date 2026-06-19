# Memento (Go)

**Categoria:** Behavioral  
**Fonte:** https://refactoring.guru/pt-br/design-patterns/memento/go/example

## Intenção

O Memento é um padrão de projeto comportamental que permite tirar um “retrato” do estado de um objeto e restaurá-lo no futuro.

O Memento não compromete a estrutura interna do objeto com o qual trabalha, nem os dados mantidos dentro dos retratos.

## Contexto do Exemplo

O padrão Memento nos permite salvar instantâneos do estado de um objeto. Você pode usar esses instantâneos para reverter o objeto ao estado anterior. É útil quando você precisa implementar operações desfazer-refazer em um objeto.

## Implementação em Go

### `originator.go` — Originador

```go
package main

type Originator struct {
	state string
}

func (e *Originator) createMemento() *Memento {
	return &Memento{state: e.state}
}

func (e *Originator) restoreMemento(m *Memento) {
	e.state = m.getSavedState()
}

func (e *Originator) setState(state string) {
	e.state = state
}

func (e *Originator) getState() string {
	return e.state
}
```

### `memento.go` — Memento

```go
package main

type Memento struct {
	state string
}

func (m *Memento) getSavedState() string {
	return m.state
}
```

### `caretaker.go` — Cuidador

```go
package main

type Caretaker struct {
	mementoArray []*Memento
}

func (c *Caretaker) addMemento(m *Memento) {
	c.mementoArray = append(c.mementoArray, m)
}

func (c *Caretaker) getMemento(index int) *Memento {
	return c.mementoArray[index]
}
```

### `main.go` — Código cliente

```go
package main

import "fmt"

func main() {

	caretaker := &Caretaker{
		mementoArray: make([]*Memento, 0),
	}

	originator := &Originator{
		state: "A",
	}

	fmt.Printf("Originator Current State: %s\n", originator.getState())
	caretaker.addMemento(originator.createMemento())

	originator.setState("B")
	fmt.Printf("Originator Current State: %s\n", originator.getState())
	caretaker.addMemento(originator.createMemento())

	originator.setState("C")
	fmt.Printf("Originator Current State: %s\n", originator.getState())
	caretaker.addMemento(originator.createMemento())

	originator.restoreMemento(caretaker.getMemento(1))
	fmt.Printf("Restored to State: %s\n", originator.getState())

	originator.restoreMemento(caretaker.getMemento(0))
	fmt.Printf("Restored to State: %s\n", originator.getState())

}
```
